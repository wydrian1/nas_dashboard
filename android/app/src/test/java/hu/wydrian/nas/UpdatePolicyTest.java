package hu.wydrian.nas;
import org.junit.Test;
import static org.junit.Assert.*;
public class UpdatePolicyTest {
    @Test public void rejectsOldMalformedOrForeignDownload() {
        String hash="a".repeat(64);
        assertTrue(UpdatePolicy.manifest(7,8,"1.1.1",hash,3000000,"/api/mobile/update?apk=1"));
        assertFalse(UpdatePolicy.manifest(7,7,"1.1.0",hash,1,"/api/mobile/update?apk=1"));
        assertFalse(UpdatePolicy.manifest(7,6,"1.0.5",hash,1,"/api/mobile/update?apk=1"));
        assertFalse(UpdatePolicy.manifest(7,8,"1.1.1",hash,1,"https://evil.example/app.apk"));
        assertFalse(UpdatePolicy.manifest(7,8,"1.1.1","bad",1,"/api/mobile/update?apk=1"));
        assertFalse(UpdatePolicy.manifest(7,8,"1.1.1",hash,UpdatePolicy.MAX_BYTES+1,"/api/mobile/update?apk=1"));
    }
    @Test public void requiresSamePackageExactVersionAndSigner() {
        int next=BuildConfig.VERSION_CODE+1;
        assertTrue(UpdatePolicy.archive("hu.wydrian.nas",next,next,"same","same"));
        assertFalse(UpdatePolicy.archive("evil.app",next,next,"same","same"));
        assertFalse(UpdatePolicy.archive("hu.wydrian.nas",next,next,"other","same"));
        assertFalse(UpdatePolicy.archive("hu.wydrian.nas",next,next+1,"same","same"));
    }
}
