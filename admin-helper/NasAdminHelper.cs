// .NET Framework Windows service. No shell, script runner, installation or service-configuration API.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace WydrianNasAdmin {
  public sealed class Rejected : Exception { public readonly int Status; public Rejected(int status) { Status=status; } }
  public sealed class Job {
    public string id,target,state,requestedBy,sessionHash;
    public long createdAt,expiresAt,finishedAt;
    public int errorCode;
    public object Public() { return new {id,target,service=Policy.Targets[target],state,requestedBy,createdAt,expiresAt,finishedAt,errorCode}; }
  }
  public static class Policy {
    public static readonly Dictionary<string,string> Targets=new Dictionary<string,string>(StringComparer.Ordinal) {
      {"dashboard","WydrianDashboard"},{"https","WydrianHttps"},{"pokemon","WydrianPokemon"},{"opencode-gateway","WydrianOpenCodeGateway"}
    };
    public static readonly Regex Opaque=new Regex("^[A-Za-z0-9_-]{43}$",RegexOptions.CultureInvariant);
    public static readonly Regex Hash=new Regex("^[a-f0-9]{64}$",RegexOptions.CultureInvariant);
    public static long Now() { return (long)(DateTime.UtcNow-new DateTime(1970,1,1)).TotalMilliseconds; }
    public static string Random() { byte[] bytes=new byte[32]; using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes); return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_'); }
    public static string Hex(byte[] bytes) { return BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant(); }
    public static Dictionary<string,object> Parse(string text) { try { var value=Json().DeserializeObject(text) as Dictionary<string,object>; if(value==null)throw new Rejected(400); return value; } catch(Rejected){throw;} catch{throw new Rejected(400);} }
    public static JavaScriptSerializer Json() { return new JavaScriptSerializer {MaxJsonLength=2*1024*1024,RecursionLimit=8}; }
    public static void Fields(Dictionary<string,object> data,params string[] fields) { if(data.Count!=fields.Length)throw new Rejected(400); foreach(string field in fields)if(!data.ContainsKey(field) || !(data[field] is string))throw new Rejected(400); }
    public static string Value(Dictionary<string,object> data,string field) { return (string)data[field]; }
    public static void Role(string role,string path) {if(role=="request" && path!="/v1/request")throw new Rejected(403);}
  }
  public sealed class Authenticator {
    readonly byte[] control,request; readonly Func<long> clock; readonly Dictionary<string,long> used=new Dictionary<string,long>(); readonly object gate=new object();
    public Authenticator(string c,string r,Func<long> now) {control=Key(c);request=Key(r);clock=now;}
    static byte[] Key(string key) {byte[] bytes=Convert.FromBase64String(key);if(bytes.Length!=32 || Convert.ToBase64String(bytes)!=key)throw new InvalidDataException();return bytes;}
    public static string Sign(string role,string method,string path,string time,string nonce,string body,string key) {
      string digest;using(var hash=SHA256.Create())digest=Policy.Hex(hash.ComputeHash(Encoding.UTF8.GetBytes(body)));
      string canonical=role+"\n"+method+"\n"+path+"\n"+time+"\n"+nonce+"\n"+digest;
      using(var hmac=new HMACSHA256(Key(key)))return Policy.Hex(hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical)));
    }
    public string Response(string role,string nonce,int status,string body) {string digest;using(var hash=SHA256.Create())digest=Policy.Hex(hash.ComputeHash(Encoding.UTF8.GetBytes(body)));using(var hmac=new HMACSHA256(role=="control"?control:request))return Policy.Hex(hmac.ComputeHash(Encoding.UTF8.GetBytes("response\n"+role+"\n"+nonce+"\n"+status+"\n"+digest)));}
    public void Check(string role,string method,string path,string time,string nonce,string body,string signature) {
      if(role!="control" && role!="request")throw new Rejected(403);
      long stamp;if(!long.TryParse(time,out stamp) || stamp<0 || stamp>long.MaxValue/1000 || Math.Abs(clock()-stamp*1000)>30000 || !Policy.Opaque.IsMatch(nonce??"") || !Policy.Hash.IsMatch(signature??""))throw new Rejected(403);
      string key=Convert.ToBase64String(role=="control"?control:request),expected=Sign(role,method,path,time,nonce,body,key);int different=0;
      for(int i=0;i<expected.Length;i++)different|=expected[i]^signature[i];if(different!=0)throw new Rejected(403);
      lock(gate) {
        var expired=new List<string>();foreach(var item in used)if(item.Value<clock()-60000)expired.Add(item.Key);foreach(string item in expired)used.Remove(item);
        if(used.ContainsKey(nonce))throw new Rejected(409);if(used.Count>=1000)throw new Rejected(429);used.Add(nonce,clock());
      }
    }
  }
  public interface ServiceOperations { string Status(string name); void Restart(string name); }
  public sealed class WindowsServices : ServiceOperations {
    // Minimum SCM/service access; cannot configure services, run programs or pass start arguments.
    const uint Connect=1,Query=4,Start=16,Stop=32;
    [StructLayout(LayoutKind.Sequential)] struct StatusData {public uint type,state,controls,win32Exit,serviceExit,checkpoint,waitHint;}
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenSCManager(string machine,string database,uint access);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenService(IntPtr manager,string name,uint access);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool CloseServiceHandle(IntPtr handle);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool QueryServiceStatus(IntPtr handle,out StatusData status);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool ControlService(IntPtr handle,uint control,out StatusData status);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool StartService(IntPtr handle,uint count,IntPtr arguments);
    static void Allowed(string name) {if(!Policy.Targets.ContainsValue(name))throw new Rejected(403);}
    static IntPtr Open(string name,uint access) {Allowed(name);IntPtr scm=OpenSCManager(null,null,Connect);if(scm==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());try{IntPtr service=OpenService(scm,name,access);if(service==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());return service;}finally{CloseServiceHandle(scm);}}
    static uint State(IntPtr handle) {StatusData status;if(!QueryServiceStatus(handle,out status))throw new Win32Exception(Marshal.GetLastWin32Error());return status.state;}
    static void Wait(IntPtr handle,uint expected) {DateTime deadline=DateTime.UtcNow.AddSeconds(45);while(State(handle)!=expected){if(DateTime.UtcNow>deadline)throw new Win32Exception(1460);Thread.Sleep(250);}}
    public string Status(string name) {IntPtr handle=Open(name,Query);try {uint state=State(handle);return state==4?"Running":state==1?"Stopped":state==2?"Starting":state==3?"Stopping":"Other";}finally{CloseServiceHandle(handle);}}
    public void Restart(string name) {
      IntPtr handle=Open(name,Query|Start|Stop);try {
        if(State(handle)!=4)throw new Win32Exception(1062); // Restart only an already running service; no dependency cascade.
        StatusData status;if(!ControlService(handle,1,out status))throw new Win32Exception(Marshal.GetLastWin32Error());Wait(handle,1);
        if(!StartService(handle,0,IntPtr.Zero))throw new Win32Exception(Marshal.GetLastWin32Error());Wait(handle,4);
      }finally{CloseServiceHandle(handle);}
    }
  }
  public sealed class Engine {
    public readonly List<Job> Jobs; readonly object gate=new object(); readonly ServiceOperations services; readonly Func<long> clock; readonly Action<List<Job>> persist; readonly Action<Job,string> audit; readonly string owner;
    public Engine(string email,ServiceOperations ops,Func<long> now,List<Job> jobs,Action<List<Job>> save,Action<Job,string> log) {owner=email;services=ops;clock=now;Jobs=jobs;persist=save;audit=log;Recover();}
    void Recover() {lock(gate){foreach(var job in Jobs) {
      if(job==null || !Policy.Targets.ContainsKey(job.target??"") || !Policy.Opaque.IsMatch(job.id??"") || !new List<string>{"pending","review","queued","running","succeeded","failed","cancelled","expired","uncertain"}.Contains(job.state))throw new InvalidDataException();
      if(job.state=="queued" || job.state=="running"){job.state="uncertain";job.finishedAt=clock();audit(job,"recovery-no-retry");}
    } Expire();persist(Jobs);}}
    void Expire() {foreach(var job in Jobs)if((job.state=="pending" || job.state=="review") && job.expiresAt<=clock()){job.state="expired";job.finishedAt=clock();audit(job,"expired");}}
    void Context(Dictionary<string,object> data) {if(Policy.Value(data,"actor")!=owner || !Policy.Hash.IsMatch(Policy.Value(data,"sessionHash")))throw new Rejected(403);}
    Job Find(string id) {if(!Policy.Opaque.IsMatch(id??""))throw new Rejected(400);var job=Jobs.Find(item=>item.id==id);if(job==null)throw new Rejected(404);return job;}
    bool Active() {return Jobs.Exists(job=>job.state=="queued" || job.state=="running");}
    void Change(Job job,string state,string eventName) {job.state=state;if(state=="cancelled" || state=="failed" || state=="succeeded" || state=="uncertain")job.finishedAt=clock();audit(job,eventName);persist(Jobs);}
    public object Status() {lock(gate){Expire();persist(Jobs);var targets=new List<object>();foreach(var item in Policy.Targets){string status;try{status=services.Status(item.Value);}catch{status="Unavailable";}targets.Add(new {id=item.Key,service=item.Value,status});}var jobs=new List<object>();for(int i=Math.Max(0,Jobs.Count-50);i<Jobs.Count;i++)jobs.Add(Jobs[i].Public());return new {available=true,targets,jobs};}}
    public Job Request(Dictionary<string,object> data,string role) {Policy.Fields(data,"target","requestedBy");string target=Policy.Value(data,"target");if(!Policy.Targets.ContainsKey(target))throw new Rejected(400);
      lock(gate){Expire();if(Active())throw new Rejected(409);if(Jobs.FindAll(item=>item.createdAt>clock()-60000).Count>=6 || Jobs.FindAll(item=>item.state=="pending" || item.state=="review").Count>=20)throw new Rejected(429);
        if(services.Status(Policy.Targets[target])!="Running")throw new Rejected(409);
        var job=new Job {id=Policy.Random(),target=target,state="pending",requestedBy=role=="request"?"OpenCode / helyi kérés":"Tulajdonosi dashboard",createdAt=clock(),expiresAt=clock()+120000};
        Jobs.Add(job);if(Jobs.Count>500)Jobs.RemoveRange(0,Jobs.Count-500);audit(job,"requested");persist(Jobs);return job;
      }
    }
    public Job Review(Dictionary<string,object> data) {Policy.Fields(data,"id","actor","sessionHash");Context(data);lock(gate){Expire();Job job=Find(Policy.Value(data,"id"));if(job.state=="expired")throw new Rejected(410);if(job.state!="pending" && job.state!="review")throw new Rejected(409);
      if(job.state=="review" && job.sessionHash!=Policy.Value(data,"sessionHash"))throw new Rejected(409);
      job.sessionHash=Policy.Value(data,"sessionHash");Change(job,"review","reviewed");return job;
    }}
    public Job Confirm(Dictionary<string,object> data) {Policy.Fields(data,"id","actor","sessionHash","confirmation");Context(data);lock(gate){Expire();Job job=Find(Policy.Value(data,"id"));if(job.state=="expired")throw new Rejected(410);
      if(job.state!="review" || job.sessionHash!=Policy.Value(data,"sessionHash") || Active())throw new Rejected(409);
      if(Policy.Value(data,"confirmation")!=Policy.Targets[job.target])throw new Rejected(400);
      if(Jobs.Exists(item=>item.id!=job.id && item.target==job.target && (item.state=="succeeded" || item.state=="failed" || item.state=="uncertain") && item.finishedAt>clock()-180000))throw new Rejected(429);
      if(services.Status(Policy.Targets[job.target])!="Running")throw new Rejected(409);
      Change(job,"queued","owner-confirmed");return job;
    }}
    public Job Cancel(Dictionary<string,object> data) {Policy.Fields(data,"id","actor","sessionHash");Context(data);lock(gate){Expire();Job job=Find(Policy.Value(data,"id"));if(job.state!="pending" && job.state!="review")throw new Rejected(409);Change(job,"cancelled","owner-cancelled");return job;}}
    public void Run(string id) {Job job;lock(gate){job=Find(id);if(job.state!="queued")return;Change(job,"running","restart-started");}
      try{services.Restart(Policy.Targets[job.target]);lock(gate){Change(job,"succeeded","restart-running");}}
      catch(Exception error){lock(gate){job.errorCode=error is Win32Exception?((Win32Exception)error).NativeErrorCode:1;Change(job,"failed","restart-failed");}}
    }
  }
  public sealed class HelperService : ServiceBase {
    HttpListener listener; Engine engine; Authenticator auth; int requests; readonly object disk=new object();
    static readonly string Root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Wydrian NAS Admin Helper");
    static readonly string Data=Path.Combine(Root,"data");
    public HelperService(){ServiceName="WydrianAdminHelper";AutoLog=true;}
    void Save(List<Job> jobs) {lock(disk){string path=Path.Combine(Data,"state.json"),temp=path+".new",text=Policy.Json().Serialize(jobs);using(var stream=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None)){byte[] bytes=Encoding.UTF8.GetBytes(text);stream.Write(bytes,0,bytes.Length);stream.Flush(true);}if(File.Exists(path))File.Replace(temp,path,path+".previous");else File.Move(temp,path);}}
    void Audit(Job job,string eventName) {lock(disk){string path=Path.Combine(Data,"audit-"+DateTime.UtcNow.ToString("yyyy-MM")+".jsonl");if(File.Exists(path) && new FileInfo(path).Length>16*1024*1024)throw new IOException("Audit capacity exhausted");string text=Policy.Json().Serialize(new {at=Policy.Now(),eventName,id=job.id,target=job.target,state=job.state,errorCode=job.errorCode})+"\n";using(var stream=new FileStream(path,FileMode.Append,FileAccess.Write,FileShare.Read)){byte[] bytes=Encoding.UTF8.GetBytes(text);stream.Write(bytes,0,bytes.Length);stream.Flush(true);}}}
    protected override void OnStart(string[] args) {
      using(var identity=WindowsIdentity.GetCurrent())if(identity.IsSystem || new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator) || !string.Equals(identity.Name,"NT SERVICE\\WydrianAdminHelper",StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Dedicated non-admin service identity required");
      var config=Policy.Parse(File.ReadAllText(Path.Combine(Root,"credentials.json"),Encoding.UTF8));Policy.Fields(config,"key","requestKey","owner");
      auth=new Authenticator(Policy.Value(config,"key"),Policy.Value(config,"requestKey"),Policy.Now);
      string path=Path.Combine(Data,"state.json");List<Job> jobs=File.Exists(path)?Policy.Json().Deserialize<List<Job>>(File.ReadAllText(path,Encoding.UTF8)):new List<Job>();if(jobs==null || jobs.Count>500)throw new InvalidDataException();
      engine=new Engine(Policy.Value(config,"owner"),new WindowsServices(),Policy.Now,jobs,Save,Audit);
      listener=new HttpListener();listener.Prefixes.Add("http://127.0.0.1:3102/");listener.TimeoutManager.EntityBody=TimeSpan.FromSeconds(10);listener.TimeoutManager.HeaderWait=TimeSpan.FromSeconds(10);listener.TimeoutManager.IdleConnection=TimeSpan.FromSeconds(10);listener.Start();
      ThreadPool.QueueUserWorkItem(delegate{while(listener.IsListening){try{var context=listener.GetContext();if(Interlocked.Increment(ref requests)>8){Interlocked.Decrement(ref requests);context.Response.StatusCode=429;context.Response.Close();continue;}ThreadPool.QueueUserWorkItem(delegate{try{Handle(context);}finally{Interlocked.Decrement(ref requests);}});}catch(HttpListenerException){break;}catch(ObjectDisposedException){break;}}});
    }
    protected override void OnStop(){if(listener!=null)listener.Close();}
    void Respond(HttpListenerContext context,int status,object payload,bool authenticated=false) {string text=Policy.Json().Serialize(payload);byte[] bytes=Encoding.UTF8.GetBytes(text);context.Response.StatusCode=status;context.Response.ContentType="application/json; charset=utf-8";context.Response.Headers["Cache-Control"]="no-store";context.Response.Headers["X-Content-Type-Options"]="nosniff";if(authenticated)context.Response.Headers["X-Nas-Response"]=auth.Response(context.Request.Headers["X-Nas-Role"],context.Request.Headers["X-Nas-Nonce"],status,text);context.Response.ContentLength64=bytes.Length;context.Response.OutputStream.Write(bytes,0,bytes.Length);context.Response.Close();}
    void Handle(HttpListenerContext context) {
      bool authenticated=false;
      try {
        var request=context.Request;string method=request.HttpMethod,path=request.Url.AbsolutePath,role=request.Headers["X-Nas-Role"];
        if(!request.IsLocal || request.Headers["Host"]!="127.0.0.1:3102" || request.Url.Query!="" || request.RawUrl!=path || request.Headers["Origin"]!=null)throw new Rejected(403);
        if(method!="GET" && method!="POST")throw new Rejected(405);
        if(method=="GET" && (path!="/v1/status" || request.ContentLength64!=0))throw new Rejected(404);
        if(method=="POST" && (path!="/v1/request" && path!="/v1/review" && path!="/v1/confirm" && path!="/v1/cancel"))throw new Rejected(404);
        string body="";if(method=="POST") {if(request.ContentLength64<1 || request.ContentLength64>4096 || request.ContentType!="application/json")throw new Rejected(400);using(var reader=new StreamReader(request.InputStream,new UTF8Encoding(false,true),false,4096))body=reader.ReadToEnd();if(Encoding.UTF8.GetByteCount(body)>4096)throw new Rejected(413);}
        auth.Check(role,method,path,request.Headers["X-Nas-Time"],request.Headers["X-Nas-Nonce"],body,request.Headers["X-Nas-Signature"]);
        authenticated=true;
        Policy.Role(role,path);
        if(method=="GET"){Respond(context,200,engine.Status(),true);return;}
        var data=Policy.Parse(body);Job job=path=="/v1/request"?engine.Request(data,role):path=="/v1/review"?engine.Review(data):path=="/v1/confirm"?engine.Confirm(data):engine.Cancel(data);
        if(path=="/v1/confirm")ThreadPool.QueueUserWorkItem(delegate{Thread.Sleep(3000);try{engine.Run(job.id);}catch{try{EventLog.WriteEntry("Admin-helper state/audit failure; no automatic retry.",System.Diagnostics.EventLogEntryType.Error);}catch{}}});
        Respond(context,path=="/v1/confirm"?202:200,new {job=job.Public()},true);
      }catch(Rejected error){try{Respond(context,error.Status,new {error="request_rejected"},authenticated);}catch{context.Response.Abort();}}
      catch{try{Respond(context,503,new {error="helper_unavailable"},authenticated);}catch{context.Response.Abort();}}
    }
    public static int Main(string[] args) {
#if HELPER_TESTS
      if(args.Length==1 && args[0]=="--self-test")return SelfTests.Run();
#endif
      if(args.Length!=0)return 2;
      ServiceBase.Run(new HelperService());return 0;
    }
  }
#if HELPER_TESTS
  public sealed class FakeServices : ServiceOperations {public int Restarts;public string Status(string name){if(!Policy.Targets.ContainsValue(name))throw new Exception();return "Running";}public void Restart(string name){if(!Policy.Targets.ContainsValue(name))throw new Exception();Restarts++;}}
  public static class SelfTests {
    static int checks;static void Assert(bool condition){checks++;if(!condition)throw new Exception("Self-test "+checks+" failed");}
    static void Reject(Action action,int status){try{action();throw new Exception("Expected rejection");}catch(Rejected error){Assert(error.Status==status);}}
    static Dictionary<string,object> Data(params string[] values){var data=new Dictionary<string,object>();for(int i=0;i<values.Length;i+=2)data.Add(values[i],values[i+1]);return data;}
    public static int Run(){try {
      long now=1791000000000;var ops=new FakeServices();var jobs=new List<Job>();var audit=new List<string>();var engine=new Engine("owner@example.com",ops,()=>now,jobs,list=>{},(item,eventName)=>audit.Add(eventName));
      Reject(()=>engine.Request(Data("target","opencode","requestedBy","test"),"request"),400);
      Reject(()=>engine.Request(Data("target","dashboard","requestedBy","test","command","whoami"),"request"),400);
      Job job=engine.Request(Data("target","dashboard","requestedBy","forged-owner"),"request");Assert(job.requestedBy=="OpenCode / helyi kérés");Assert(ops.Restarts==0);
      string hash=new string('a',64);var context=Data("id",job.id,"actor","owner@example.com","sessionHash",hash);
      Reject(()=>engine.Confirm(Data("id",job.id,"actor","owner@example.com","sessionHash",hash,"confirmation","WydrianDashboard")),409);
      engine.Review(context);Reject(()=>engine.Review(Data("id",job.id,"actor","other@example.com","sessionHash",hash)),403);
      Reject(()=>engine.Confirm(Data("id",job.id,"actor","owner@example.com","sessionHash",new string('b',64),"confirmation","WydrianDashboard")),409);
      Reject(()=>engine.Confirm(Data("id",job.id,"actor","owner@example.com","sessionHash",hash,"confirmation","WydrianHttps")),400);
      var confirm=Data("id",job.id,"actor","owner@example.com","sessionHash",hash,"confirmation","WydrianDashboard");engine.Confirm(confirm);Assert(ops.Restarts==0);Reject(()=>engine.Confirm(confirm),409);engine.Run(job.id);engine.Run(job.id);Assert(ops.Restarts==1);Assert(job.state=="succeeded");Assert(audit.Contains("owner-confirmed"));
      Job second=engine.Request(Data("target","dashboard","requestedBy","test"),"control");engine.Review(Data("id",second.id,"actor","owner@example.com","sessionHash",hash));Reject(()=>engine.Confirm(Data("id",second.id,"actor","owner@example.com","sessionHash",hash,"confirmation","WydrianDashboard")),429);
      now+=120001;Reject(()=>engine.Review(Data("id",second.id,"actor","owner@example.com","sessionHash",hash)),410);
      now+=60000;Job queued=engine.Request(Data("target","https","requestedBy","test"),"control");engine.Review(Data("id",queued.id,"actor","owner@example.com","sessionHash",hash));engine.Confirm(Data("id",queued.id,"actor","owner@example.com","sessionHash",hash,"confirmation","WydrianHttps"));
      var recovered=new Engine("owner@example.com",ops,()=>now,jobs,list=>{},(item,eventName)=>audit.Add(eventName));Assert(queued.state=="uncertain");recovered.Run(queued.id);Assert(ops.Restarts==1);
      string key=Convert.ToBase64String(new byte[32]),other=Convert.ToBase64String(Encoding.UTF8.GetBytes(new string('x',32))),time=(now/1000).ToString(),nonce=Policy.Random(),body="{}",signature=Authenticator.Sign("control","GET","/v1/status",time,nonce,body,key);
      var auth=new Authenticator(key,other,()=>now);auth.Check("control","GET","/v1/status",time,nonce,body,signature);Reject(()=>auth.Check("control","GET","/v1/status",time,nonce,body,signature),409);
      Assert(Authenticator.Sign("control","POST","/v1/request","1791000000",new string('a',43),"{\"target\":\"dashboard\"}",key)=="1b1c690c07bbe38a93be960d83838aebfc73ecfda81396125bfe7ebfe2e35ab6");
      Assert(auth.Response("control",new string('a',43),200,"{\"available\":true}")=="69dd47c39dec9f336619f7dfd13819bd1a490d90c8ae67b0a0625832e32d2681");
      Reject(()=>auth.Check("request","GET","/v1/status",time,Policy.Random(),body,signature),403);
      Reject(()=>auth.Check("control","POST","/v1/confirm",time,Policy.Random(),body,signature),403);
      Reject(()=>auth.Check("control","GET","/v1/status","1",Policy.Random(),body,signature),403);
      Policy.Role("request","/v1/request");foreach(string path in new[]{"/v1/status","/v1/review","/v1/confirm","/v1/cancel"})Reject(()=>Policy.Role("request",path),403);
      Assert(Policy.Targets.Count==4);Assert(!Policy.Targets.ContainsValue("WydrianAdminHelper"));Console.WriteLine("Admin helper self-tests: "+checks+" passed; no Windows services were touched.");return 0;
    }catch{Console.Error.WriteLine("Admin helper self-tests failed.");return 1;}}
  }
#endif
}
