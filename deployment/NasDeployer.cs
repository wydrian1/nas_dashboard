// Dedicated non-admin broker. File-queue protocol; no HTTP endpoint, shell or caller commands.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.ServiceProcess;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Xml;
using Microsoft.Win32.SafeHandles;
using TimeoutException=System.TimeoutException;

namespace WydrianDeployment {
  public static class Policy {
    public const string Project=@"D:\!nas",Service="WydrianDeployer";
    public static readonly Regex Id=new Regex("^[a-f0-9]{32}$"),Hash=new Regex("^[a-f0-9]{64}$"),Commit=new Regex("^[a-f0-9]{40}$");
    public static readonly string Protected=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Wydrian NAS Deployer");
    public static long Now(){return (long)(DateTime.UtcNow-new DateTime(1970,1,1)).TotalMilliseconds;}
    public static JavaScriptSerializer Json(){return new JavaScriptSerializer{MaxJsonLength=4*1024*1024,RecursionLimit=12};}
    public static string Hex(byte[] data){return BitConverter.ToString(data).Replace("-","").ToLowerInvariant();}
    public static string Digest(byte[] data){using(var sha=SHA256.Create())return Hex(sha.ComputeHash(data));}
    public static string FileHash(string path){using(var stream=SafeFiles.Read(path))using(var sha=SHA256.Create())return Hex(sha.ComputeHash(stream));}
    public static string Sign(string key,string value){byte[] bytes=Convert.FromBase64String(key);if(bytes.Length!=32)throw new InvalidDataException();using(var mac=new HMACSHA256(bytes))return Hex(mac.ComputeHash(Encoding.UTF8.GetBytes(value)));}
    public static bool Equal(string a,string b){if(a==null||b==null||a.Length!=b.Length)return false;int diff=0;for(int i=0;i<a.Length;i++)diff|=a[i]^b[i];return diff==0;}
    public static void Fields(Dictionary<string,object> data,params string[] keys){if(data==null||data.Count!=keys.Length)throw new InvalidDataException();foreach(var key in keys)if(!data.ContainsKey(key))throw new InvalidDataException();}
    public static Dictionary<string,object> Parse(string text){return Json().DeserializeObject(text) as Dictionary<string,object>;}
    public static bool PathAllowed(string path){
      if(path==null||path.Length>240||!Regex.IsMatch(path,"^[A-Za-z0-9_@()+.,/-]+$"))return false;
      foreach(string part in path.Split('/'))if(part==""||part=="."||part==".."||Regex.IsMatch(part,@"[. ]$|^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)|^\.env(?:\.|$)",RegexOptions.IgnoreCase))return false;
      return path.StartsWith("web/",StringComparison.Ordinal)||Regex.IsMatch(path,@"^worker/(?:lib/(?:pokemon/|mobile/|finance/).+\.ts|lib/(?:db-schema|opencode-schema|users|url-policy|feed-download|sql-rows)\.ts|scripts/Pokemon-Worker\.ts)$")||path=="apk/release.apk";
    }
    public static Manifest Manifest(string text,string id){
      var data=Parse(text);Fields(data,"version","id","commit","checks","files");
      if(!Equals(data["version"],1)||!Id.IsMatch(id)||!Equals(data["id"],id)||!(data["commit"] is string)||!Commit.IsMatch((string)data["commit"]))throw new InvalidDataException();
      var checks=data["checks"] as Dictionary<string,object>;Fields(checks,"tests","typecheck","build","worker","android");
      foreach(var key in new[]{"tests","typecheck","build","worker"})if(!Equals(checks[key],true))throw new InvalidDataException("Required checks missing");
      var entries=data["files"] as object[];if(entries==null||entries.Length==0||entries.Length>20000)throw new InvalidDataException();
      var result=new Manifest{id=id,commit=(string)data["commit"]};var paths=new HashSet<string>(StringComparer.OrdinalIgnoreCase);long total=0;
      foreach(object item in entries){var entry=item as Dictionary<string,object>;Fields(entry,"path","size","sha256");string path=entry["path"] as string,hash=entry["sha256"] as string;if(!(entry["size"] is int)&&!(entry["size"] is long))throw new InvalidDataException();long size=Convert.ToInt64(entry["size"]);if(!PathAllowed(path)||hash==null||!Hash.IsMatch(hash)||!paths.Add(path)||size<0||size>512*1024*1024)throw new InvalidDataException();total=checked(total+size);if(total>4L*1024*1024*1024)throw new InvalidDataException();result.files.Add(new Artifact{path=path,size=size,sha256=hash});}
      result.web=result.files.Exists(file=>file.path.StartsWith("web/"));result.worker=result.files.Exists(file=>file.path.StartsWith("worker/"));result.apk=paths.Contains("apk/release.apk");
      if(result.web)foreach(var file in new[]{"web/BUILD_ID","web/required-server-files.json","web/server/app/page.js"})if(!paths.Contains(file))throw new InvalidDataException("Incomplete web build");
      if(result.worker)foreach(var file in new[]{"worker/scripts/Pokemon-Worker.ts","worker/lib/db-schema.ts","worker/lib/opencode-schema.ts","worker/lib/pokemon/schema.ts","worker/lib/pokemon/store.ts","worker/lib/mobile/schema.ts","worker/lib/finance/schema.ts"})if(!paths.Contains(file))throw new InvalidDataException("Incomplete worker");
      if(result.apk&&!Equals(checks["android"],true))throw new InvalidDataException("Android checks missing");return result;
    }
  }
  public sealed class Artifact{public string path,sha256;public long size;}
  public sealed class Manifest{public string id,commit;public bool web,worker,apk;public List<Artifact> files=new List<Artifact>();}
  public sealed class Job{public string id,commit,state,phase;public int errorCode;public long at;}
  public sealed class WebSwap {
    readonly string active,previous,incoming,failed;bool oldMoved,newMoved;
    public WebSwap(string current,string old,string next,string rejected){active=current;previous=old;incoming=next;failed=rejected;}
    public void Activate(){SafeFiles.Folder(active);SafeFiles.Folder(incoming);if(Directory.Exists(previous)||Directory.Exists(failed))throw new InvalidDataException();Directory.Move(active,previous);oldMoved=true;Directory.Move(incoming,active);newMoved=true;}
    public void Rollback(){if(newMoved)Directory.Move(active,failed);if(oldMoved)Directory.Move(previous,active);}
  }
  public static class SafeFiles {
    [StructLayout(LayoutKind.Sequential)] struct Info{public uint attributes,creationLow,creationHigh,accessLow,accessHigh,writeLow,writeHigh,volume,sizeHigh,sizeLow,links,indexHigh,indexLow;}
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFinalPathNameByHandle(SafeFileHandle file,StringBuilder name,uint size,uint flags);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle file,out Info info);
    public static void Directories(string path){for(var current=new DirectoryInfo(Path.GetDirectoryName(Path.GetFullPath(path)));current!=null;current=current.Parent)if((current.Attributes&FileAttributes.ReparsePoint)!=0)throw new InvalidDataException("Reparse directory rejected");}
    public static void Handle(FileStream stream,string path){var buffer=new StringBuilder(32768);uint size=GetFinalPathNameByHandle(stream.SafeFileHandle,buffer,(uint)buffer.Capacity,0);Info info;if(size==0||size>=buffer.Capacity||!GetFileInformationByHandle(stream.SafeFileHandle,out info)||info.links!=1)throw new InvalidDataException("Linked file rejected");string actual=buffer.ToString();if(actual.StartsWith(@"\\?\"))actual=actual.Substring(4);if(!string.Equals(actual,Path.GetFullPath(path),StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("Redirected file rejected");}
    public static FileStream Read(string path){Directories(path);if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new InvalidDataException();var stream=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read);try{Handle(stream,path);return stream;}catch{stream.Dispose();throw;}}
    public static string Text(string path,int max){using(var stream=Read(path)){if(stream.Length>max)throw new InvalidDataException();using(var reader=new StreamReader(stream,new UTF8Encoding(false,true)))return reader.ReadToEnd();}}
    public static void Copy(string source,string destination,Artifact file){Directory.CreateDirectory(Path.GetDirectoryName(destination));using(var input=Read(source)){if(input.Length!=file.size)throw new InvalidDataException("Artifact size changed");using(var output=new FileStream(destination,FileMode.CreateNew,FileAccess.Write,FileShare.None)){input.CopyTo(output);output.Flush(true);}if(Policy.FileHash(destination)!=file.sha256)throw new InvalidDataException("Artifact hash changed");Handle(input,source);}}
    public static void Rewrite(string path,string text){Directories(path);using(var stream=new FileStream(path,FileMode.Open,FileAccess.ReadWrite,FileShare.None)){Handle(stream,path);byte[] bytes=Encoding.UTF8.GetBytes(text);stream.Position=0;stream.Write(bytes,0,bytes.Length);stream.SetLength(bytes.Length);stream.Flush(true);}}
    public static void Atomic(string path,string text){Directories(path);string temp=path+".new";using(var stream=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None)){byte[] bytes=Encoding.UTF8.GetBytes(text);stream.Write(bytes,0,bytes.Length);stream.Flush(true);}if(File.Exists(path))File.Replace(temp,path,null);else File.Move(temp,path);}
    public static void Folder(string path){if((File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0)throw new InvalidDataException("Reparse target rejected");Directories(Path.Combine(path,"entry"));}
  }
  public interface Services{void Validate();void Stop(string name);void Start(string name);}
  public sealed class WindowsServices:Services {
    [StructLayout(LayoutKind.Sequential)] struct Status{public uint type,state,controls,win32Exit,serviceExit,checkpoint,waitHint;}
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Config{public uint type,start,error;public IntPtr binary,group;public uint tag;public IntPtr dependencies,account,display;}
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenSCManager(string machine,string database,uint access);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenService(IntPtr manager,string name,uint access);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool CloseServiceHandle(IntPtr handle);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool QueryServiceStatus(IntPtr handle,out Status status);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryServiceConfig(IntPtr handle,IntPtr buffer,uint size,out uint needed);
    [DllImport("advapi32.dll",SetLastError=true)] static extern bool ControlService(IntPtr handle,uint control,out Status status);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool StartService(IntPtr handle,uint count,IntPtr arguments);
    static IntPtr Open(string name,uint access){if(name!="WydrianDashboard"&&name!="WydrianPokemon")throw new InvalidDataException();IntPtr scm=OpenSCManager(null,null,1);if(scm==IntPtr.Zero)throw new Win32Exception();try{IntPtr service=OpenService(scm,name,access);if(service==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());return service;}finally{CloseServiceHandle(scm);}}
    static uint State(IntPtr handle){Status value;if(!QueryServiceStatus(handle,out value))throw new Win32Exception(Marshal.GetLastWin32Error());return value.state;}
    static void Wait(IntPtr handle,uint state){DateTime until=DateTime.UtcNow.AddSeconds(45);while(State(handle)!=state){if(DateTime.UtcNow>until)throw new TimeoutException();Thread.Sleep(250);}}
    public void Validate(){foreach(string name in new[]{"WydrianDashboard","WydrianPokemon"}){IntPtr handle=Open(name,5);try{uint needed;QueryServiceConfig(handle,IntPtr.Zero,0,out needed);if(needed==0||needed>65536)throw new InvalidDataException();IntPtr memory=Marshal.AllocHGlobal((int)needed);try{if(!QueryServiceConfig(handle,memory,needed,out needed))throw new Win32Exception(Marshal.GetLastWin32Error());var value=(Config)Marshal.PtrToStructure(memory,typeof(Config));string account=Marshal.PtrToStringUni(value.account),binary=Marshal.PtrToStringUni(value.binary);string expected=name=="WydrianDashboard"?@"NT SERVICE\WydrianDashboard":@"NT AUTHORITY\LocalService";if(!string.Equals(account,expected,StringComparison.OrdinalIgnoreCase)||!string.Equals(binary,"\""+Path.Combine(Policy.Project,@".runtime\services",name+".exe")+"\"",StringComparison.OrdinalIgnoreCase)||State(handle)!=4)throw new InvalidDataException("Pinned non-admin target is not running");}finally{Marshal.FreeHGlobal(memory);}}finally{CloseServiceHandle(handle);}}}
    public void Stop(string name){IntPtr handle=Open(name,0x24);try{if(State(handle)==1)return;Status status;if(!ControlService(handle,1,out status))throw new Win32Exception(Marshal.GetLastWin32Error());Wait(handle,1);}finally{CloseServiceHandle(handle);}}
    public void Start(string name){IntPtr handle=Open(name,0x14);try{if(State(handle)==4)return;if(!StartService(handle,0,IntPtr.Zero))throw new Win32Exception(Marshal.GetLastWin32Error());Wait(handle,4);}finally{CloseServiceHandle(handle);}}
  }
  public sealed class Operations {
    readonly Dictionary<string,object> config;readonly Services services;readonly string area=Path.Combine(Policy.Project,@".runtime\deployment");
    public Operations(Dictionary<string,object> settings,Services targets){config=settings;services=targets;}
    string Process(string tool,string arguments,int seconds){string executable=Path.Combine(Policy.Protected,(string)config[tool]);var start=new ProcessStartInfo(executable,arguments){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true,WorkingDirectory=Policy.Protected};foreach(string name in new[]{"NODE_OPTIONS","NODE_PATH","JAVA_TOOL_OPTIONS","_JAVA_OPTIONS","JDK_JAVA_OPTIONS"})start.EnvironmentVariables.Remove(name);var text=new StringBuilder();var gate=new object();using(var process=new Process{StartInfo=start}){DataReceivedEventHandler read=(sender,eventArgs)=>{if(eventArgs.Data!=null)lock(gate){if(text.Length<65536)text.AppendLine(eventArgs.Data);}};process.OutputDataReceived+=read;process.ErrorDataReceived+=read;process.Start();process.BeginOutputReadLine();process.BeginErrorReadLine();if(!process.WaitForExit(seconds*1000)){process.Kill();throw new TimeoutException();}process.WaitForExit();if(process.ExitCode!=0)throw new InvalidDataException("Fixed verifier failed");return text.ToString();}}
    static string Quote(string value){return "\""+value+"\"";}
    void Apk(string path){string output=Process("java","-jar "+Quote(Path.Combine(Policy.Protected,"apksigner.jar"))+" verify --print-certs "+Quote(path),60);var signers=Regex.Matches(output,@"Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]{64})");if(signers.Count!=1||!string.Equals(signers[0].Groups[1].Value,(string)config["signer"],StringComparison.OrdinalIgnoreCase))throw new InvalidDataException("APK signer mismatch");string metadata=Process("aapt","dump badging "+Quote(path),60);var package=Regex.Match(metadata,@"(?m)^package: name='hu\.wydrian\.nas' versionCode='(\d+)' versionName='([0-9.]+)'");if(!package.Success)throw new InvalidDataException("APK package mismatch");string existing=Process("aapt","dump badging "+Quote(Path.Combine(Policy.Project,@".runtime\artifacts\Wydrian-NAS-1.0.0.apk")),60);var version=Regex.Match(existing,@"versionCode='(\d+)'");if(!version.Success||int.Parse(package.Groups[1].Value)<int.Parse(version.Groups[1].Value)||(package.Groups[1].Value==version.Groups[1].Value&&Policy.FileHash(path)!=Policy.FileHash(Path.Combine(Policy.Project,@".runtime\artifacts\Wydrian-NAS-1.0.0.apk"))))throw new InvalidDataException("APK downgrade/version reuse rejected");}
    public void Apply(Manifest manifest,string release,Action<string> phase){
      services.Validate();string dashboardXml=Path.Combine(Policy.Project,@".runtime\services\WydrianDashboard.xml"),workerXml=Path.Combine(Policy.Project,@".runtime\services\WydrianPokemon.xml"),workerHash=Path.Combine(Policy.Protected,@"data\worker-hash.txt");
      if(Policy.FileHash(dashboardXml)!=(string)config["dashboardXmlHash"]||Policy.FileHash(workerXml)!=SafeFiles.Text(workerHash,128).Trim())throw new InvalidDataException("Service configuration changed outside broker");
      string oldWorker=SafeFiles.Text(workerXml,32768),oldHash=Policy.FileHash(workerXml),active=Path.Combine(Policy.Project,".next"),previous=Path.Combine(Policy.Project,".next-backup-delegated-"+manifest.id),apk=Path.Combine(Policy.Project,@".runtime\artifacts\Wydrian-NAS-1.0.0.apk"),oldApk=Path.Combine(release,"previous.apk"),newApk=Path.Combine(release,@"apk\release.apk");
      if(manifest.apk)Apk(newApk);if(manifest.web){SafeFiles.Folder(active);SafeFiles.Folder(Path.Combine(release,"web"));if(Directory.Exists(previous))throw new InvalidDataException();}
      SafeFiles.Atomic(Path.Combine(release,"previous-worker.xml"),oldWorker);if(manifest.apk){var info=new FileInfo(apk);SafeFiles.Copy(apk,oldApk,new Artifact{size=info.Length,sha256=Policy.FileHash(apk)});}
      phase("backup");Process("node",Quote(Path.Combine(Policy.Protected,"Deployment-Database.mjs"))+" backup",120);
      var swap=new WebSwap(active,previous,Path.Combine(release,"web"),Path.Combine(release,"failed-web"));bool dashboardStopped=false,workerStopped=false,xmlChanged=false,apkChanged=false;
      try{
        phase("activating");if(manifest.web){dashboardStopped=true;services.Stop("WydrianDashboard");}if(manifest.worker){workerStopped=true;services.Stop("WydrianPokemon");}
        if(manifest.web){swap.Activate();string cache=Path.Combine(active,"cache");Directory.CreateDirectory(cache);var acl=Directory.GetAccessControl(cache);acl.AddAccessRule(new FileSystemAccessRule(@"NT SERVICE\WydrianDashboard",FileSystemRights.Modify,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));Directory.SetAccessControl(cache,acl);}
        if(manifest.worker){var xml=new XmlDocument{XmlResolver=null};xml.LoadXml((string)config["workerTemplate"]);xml.SelectSingleNode("/service/arguments").InnerText="--env-file="+Quote(Path.Combine(Policy.Project,".env.local"))+" --experimental-strip-types "+Quote(Path.Combine(release,@"worker\scripts\Pokemon-Worker.ts"));xmlChanged=true;SafeFiles.Rewrite(workerXml,xml.OuterXml);SafeFiles.Atomic(workerHash,Policy.FileHash(workerXml));}
        long started=Policy.Now();if(manifest.web)services.Start("WydrianDashboard");if(manifest.worker)services.Start("WydrianPokemon");
        phase("health");if(manifest.web){bool ready=false;for(int i=0;i<25;i++){try{var request=(HttpWebRequest)WebRequest.Create("http://127.0.0.1:3000/");request.Timeout=2000;request.AllowAutoRedirect=false;using(var response=(HttpWebResponse)request.GetResponse())if(response.StatusCode==HttpStatusCode.OK){ready=true;break;}}catch{}Thread.Sleep(1000);}if(!ready)throw new InvalidDataException("Dashboard health failed");}
        if(manifest.worker){bool ready=false;for(int i=0;i<20;i++){long heartbeat;if(long.TryParse(Process("node",Quote(Path.Combine(Policy.Protected,"Deployment-Database.mjs"))+" worker",30).Trim(),out heartbeat)&&heartbeat>=started){ready=true;break;}Thread.Sleep(1000);}if(!ready)throw new InvalidDataException("Worker heartbeat failed");}
        if(manifest.apk){string temporary=Path.Combine(Policy.Project,@".runtime\artifacts\delegated-"+manifest.id+".apk");var info=new FileInfo(newApk);SafeFiles.Copy(newApk,temporary,new Artifact{size=info.Length,sha256=Policy.FileHash(newApk)});apkChanged=true;File.Replace(temporary,apk,null);}
        phase("verified");
      }catch{
        try{phase("rollback");}catch{}bool restored=true;
        try{if(manifest.web&&dashboardStopped){services.Stop("WydrianDashboard");swap.Rollback();}if(manifest.worker&&workerStopped){services.Stop("WydrianPokemon");if(xmlChanged){SafeFiles.Rewrite(workerXml,oldWorker);SafeFiles.Atomic(workerHash,oldHash);}}if(apkChanged){string temporary=Path.Combine(Policy.Project,@".runtime\artifacts\rollback-"+manifest.id+".apk");var info=new FileInfo(oldApk);SafeFiles.Copy(oldApk,temporary,new Artifact{size=info.Length,sha256=Policy.FileHash(oldApk)});File.Replace(temporary,apk,null);}if(dashboardStopped)services.Start("WydrianDashboard");if(workerStopped)services.Start("WydrianPokemon");}catch{restored=false;}
        if(!restored)throw new IOException("Rollback uncertain; do not retry automatically");throw;
      }
    }
  }
  public sealed class Broker:ServiceBase {
    readonly string area=Path.Combine(Policy.Project,@".runtime\deployment"),data=Path.Combine(Policy.Protected,"data");readonly object gate=new object();List<Job> jobs;string key;Operations operations;Timer timer;
    public Broker(){ServiceName=Policy.Service;AutoLog=true;}
    void Save(){SafeFiles.Atomic(Path.Combine(data,"state.json"),Policy.Json().Serialize(jobs));}
    void Audit(Job job){string path=Path.Combine(data,"audit-"+DateTime.UtcNow.ToString("yyyy-MM")+".jsonl");if(File.Exists(path)&&new FileInfo(path).Length>16*1024*1024)throw new IOException("Audit full");using(var stream=new FileStream(path,FileMode.Append,FileAccess.Write,FileShare.Read)){byte[] bytes=Encoding.UTF8.GetBytes(Policy.Json().Serialize(job)+"\n");stream.Write(bytes,0,bytes.Length);stream.Flush(true);}}
    void Change(Job job,string state,string phase){job.state=state;job.phase=phase;job.at=Policy.Now();Audit(job);Save();string payload=Policy.Json().Serialize(job);SafeFiles.Atomic(Path.Combine(area,@"results",job.id+".json"),Policy.Json().Serialize(new{payload,signature=Policy.Sign(key,"result\n"+payload)}));}
    protected override void OnStart(string[] args){using(var identity=WindowsIdentity.GetCurrent())if(identity.IsSystem||new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)||!string.Equals(identity.Name,@"NT SERVICE\WydrianDeployer",StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Dedicated non-admin identity required");
      var config=Policy.Parse(SafeFiles.Text(Path.Combine(Policy.Protected,"config.json"),65536));key=(string)config["key"];Policy.Sign(key,"startup");operations=new Operations(config,new WindowsServices());string state=Path.Combine(data,"state.json");jobs=File.Exists(state)?Policy.Json().Deserialize<List<Job>>(SafeFiles.Text(state,4*1024*1024)):new List<Job>();if(jobs==null||jobs.Count>500)throw new InvalidDataException();foreach(var job in jobs){if(job==null||!Policy.Id.IsMatch(job.id??""))throw new InvalidDataException();if(job.state=="accepted"||job.state=="running")Change(job,"uncertain","interrupted-no-retry");}Save();timer=new Timer(Tick,null,1000,2000);
    }
    protected override void OnStop(){if(timer!=null)timer.Dispose();}
    void Tick(object ignored){if(!Monitor.TryEnter(gate))return;try{SafeFiles.Folder(Path.Combine(area,"inbox"));string[] directories=Directory.GetDirectories(Path.Combine(area,"inbox"));if(directories.Length>500)return;foreach(string directory in directories){string id=Path.GetFileName(directory);if(!Policy.Id.IsMatch(id)||jobs.Exists(job=>job.id==id)||!File.Exists(Path.Combine(directory,"request.json")))continue;Run(directory,id);}}catch{try{EventLog.WriteEntry("Deployment broker failed closed; inspect audit/state. No automatic job retry.",EventLogEntryType.Error);}catch{}}finally{Monitor.Exit(gate);}}
    void Run(string directory,string id){
      Job job=null;try{
        var request=Policy.Parse(SafeFiles.Text(Path.Combine(directory,"request.json"),4096));Policy.Fields(request,"id","time","hash","signature");long time;string stamp=request["time"] as string,hash=request["hash"] as string,signature=request["signature"] as string;if(!Equals(request["id"],id)||stamp==null||!Regex.IsMatch(stamp,"^[0-9]{13}$")||!long.TryParse(stamp,out time)||Math.Abs(Policy.Now()-time)>15*60*1000||hash==null||!Policy.Hash.IsMatch(hash)||!Policy.Equal(signature,Policy.Sign(key,"deploy\n"+id+"\n"+stamp+"\n"+hash)))throw new InvalidDataException("Unauthenticated request");
        string text=SafeFiles.Text(Path.Combine(directory,"manifest.json"),4*1024*1024);if(Policy.Digest(Encoding.UTF8.GetBytes(text))!=hash)throw new InvalidDataException("Manifest changed");var manifest=Policy.Manifest(text,id);job=new Job{id=id,commit=manifest.commit};jobs.Add(job);if(jobs.Count>500)throw new IOException("State capacity exhausted");Change(job,"accepted","authenticated");
        string release=Path.Combine(area,@"releases",id);if(Directory.Exists(release))throw new InvalidDataException("Existing release rejected");Directory.CreateDirectory(release);Change(job,"running","copying");foreach(var file in manifest.files)SafeFiles.Copy(Path.Combine(directory,file.path.Replace('/',Path.DirectorySeparatorChar)),Path.Combine(release,file.path.Replace('/',Path.DirectorySeparatorChar)),file);
        operations.Apply(manifest,release,phase=>Change(job,"running",phase));Change(job,"succeeded","complete");
      }catch(Exception error){if(job==null){job=new Job{id=id,commit="",errorCode=1};jobs.Add(job);}else job.errorCode=error is Win32Exception?((Win32Exception)error).NativeErrorCode:1;Change(job,error is IOException&&error.Message.StartsWith("Rollback uncertain")?"uncertain":"failed",job.phase??"rejected");}
    }
    public static int Main(string[] args){
#if DEPLOYER_TESTS
      if(args.Length==1&&args[0]=="--self-test")return SelfTests.Run();
#endif
      if(args.Length!=0)return 2;ServiceBase.Run(new Broker());return 0;
    }
  }
#if DEPLOYER_TESTS
  public static class SelfTests {
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateHardLink(string file,string existing,IntPtr reserved);
    static int checks;static void Assert(bool value){checks++;if(!value)throw new Exception("Check "+checks);}
    static void Reject(Action action){bool failed=false;try{action();}catch{failed=true;}Assert(failed);}
    public static int Run(){try{
      foreach(string path in new[]{"web/BUILD_ID","web/server/app/page.js","worker/lib/pokemon/store.ts","worker/lib/finance/schema.ts","apk/release.apk"})Assert(Policy.PathAllowed(path));
      foreach(string path in new[]{"web/../data/file","web/.env.local","web/C:/x","web/CON.txt","web/server/foo.","worker/scripts/other.ts","worker/lib/admin-helper/client.ts","apk/other.apk","https/file","web//file",@"web\file","web/x:y"})Assert(!Policy.PathAllowed(path));
      string id=new string('a',32),key=Convert.ToBase64String(new byte[32]),hash=new string('b',64);Assert(Policy.Sign(key,"deploy\n"+id+"\n1791000000000\n"+hash)=="9efa7cd7962549d5830a9bb3df995c15a42446f0c24f9b1208f3d063b88f6d27");
      var manifest=new{version=1,id,commit=new string('c',40),checks=new{tests=true,typecheck=true,build=true,worker=true,android=true},files=new[]{new{path="apk/release.apk",size=1,sha256=hash}}};var valid=Policy.Json().Serialize(manifest);Assert(Policy.Manifest(valid,id).apk);Reject(()=>Policy.Manifest(valid.Replace("\"tests\":true","\"tests\":false"),id));Reject(()=>Policy.Manifest(valid.Replace("apk/release.apk","web/../file"),id));Reject(()=>Policy.Manifest(valid.Replace("apk/release.apk","worker/lib/pokemon/store.ts"),id));Reject(()=>Policy.Manifest(valid.Replace("\"version\":1","\"command\":\"whoami\",\"version\":1"),id));Reject(()=>Policy.Manifest(valid,new string('d',32)));Reject(()=>new WindowsServices().Stop("WydrianHttps"));Reject(()=>new WindowsServices().Start("WydrianOpenCodeGateway"));
      string temporary=Path.Combine(Policy.Project,@".runtime\deployer-build","test-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(temporary);try{
        string artifact=Path.Combine(temporary,"source.bin"),copy=Path.Combine(temporary,"copy.bin");File.WriteAllText(artifact,"approved");SafeFiles.Copy(artifact,copy,new Artifact{size=new FileInfo(artifact).Length,sha256=Policy.FileHash(artifact)});Assert(Policy.FileHash(copy)==Policy.FileHash(artifact));Reject(()=>SafeFiles.Copy(artifact,Path.Combine(temporary,"tampered.bin"),new Artifact{size=new FileInfo(artifact).Length,sha256=new string('0',64)}));Assert(CreateHardLink(Path.Combine(temporary,"linked.bin"),artifact,IntPtr.Zero));Reject(()=>SafeFiles.Read(artifact));File.Delete(Path.Combine(temporary,"linked.bin"));
        string active=Path.Combine(temporary,"active"),previous=Path.Combine(temporary,"previous"),incoming=Path.Combine(temporary,"incoming"),failed=Path.Combine(temporary,"failed");Directory.CreateDirectory(active);Directory.CreateDirectory(incoming);File.WriteAllText(Path.Combine(active,"BUILD_ID"),"old");File.WriteAllText(Path.Combine(incoming,"BUILD_ID"),"new");var swap=new WebSwap(active,previous,incoming,failed);swap.Activate();Assert(File.ReadAllText(Path.Combine(active,"BUILD_ID"))=="new");Assert(File.ReadAllText(Path.Combine(previous,"BUILD_ID"))=="old");swap.Rollback();Assert(File.ReadAllText(Path.Combine(active,"BUILD_ID"))=="old");Assert(File.ReadAllText(Path.Combine(failed,"BUILD_ID"))=="new");
        var refusal=new WebSwap(active,failed,failed,previous);Reject(()=>refusal.Activate());Assert(File.ReadAllText(Path.Combine(active,"BUILD_ID"))=="old");
      }finally{Directory.Delete(temporary,true);}
      Console.WriteLine("Deployer native self-tests: "+checks+" passed; no service was touched.");return 0;
    }catch(Exception error){Console.Error.WriteLine(error.Message);return 1;}}
  }
#endif
}
