package hu.wydrian.nas;

import java.net.URI;

final class UrlPolicy {
    static final String ORIGIN = "https://nas.wydrian.hu";
    static final String OPENCODE_ORIGIN = "https://opencode.nas.wydrian.hu";
    static boolean internal(String input) {
        try {
            URI uri = URI.create(input);
            return "https".equals(uri.getScheme()) && ("nas.wydrian.hu".equals(uri.getHost()) || "opencode.nas.wydrian.hu".equals(uri.getHost()))
                    && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception ignored) { return false; }
    }
    static boolean openCode(String input) {
        try { URI uri=URI.create(input); return internal(input) && ("opencode.nas.wydrian.hu".equals(uri.getHost()) || "/opencode".equals(uri.getPath()) || uri.getPath().startsWith("/opencode/")); }
        catch(Exception ignored) { return false; }
    }
    static String notificationPath(String value) {
        return value != null && (value.matches("/pokemon(?:#shop-[a-z0-9]+)?") || value.matches("/notes#task-[1-9][0-9]*") || value.equals("/")) ? value : "/pokemon";
    }
    static String productUrl(String shop, String value) {
        if(shop==null||value==null||value.length()>4096)return null;
        String host;
        switch(shop){
            case "gamerunner":host="gamerunner.hu";break;case "mythgames":host="mythgames.eu";break;
            case "pottyoszebra":host="pottyoszebra.hu";break;case "grandline":host="grandline.hu";break;
            case "krodomcards":host="krodomcards.hu";break;case "jateknet":host="jateknet.hu";break;
            case "reflexshop":host="reflexshop.hu";break;case "geekempire":host="geekempire.hu";break;
            case "tcgfutar":host="tcgfutar.hu";break;case "sportkartyabolt":host="sportkartyabolt.hu";break;
            case "rtcollectorsclub":host="rtcollectorsclub.com";break;case "cardverse":host="cardverse.hu";break;
            case "metagames":host="metagames.hu";break;case "tcgbolt":host="tcgbolt.hu";break;
            default:return null;
        }
        try{URI uri=URI.create(value);return "https".equals(uri.getScheme())&&uri.getRawUserInfo()==null
            &&(uri.getPort()==-1||uri.getPort()==443)&&(host.equals(uri.getHost())||("www."+host).equals(uri.getHost()))?value:null;}
        catch(Exception ignored){return null;}
    }
    static boolean external(String input) {
        try { URI uri = URI.create(input); return "https".equals(uri.getScheme()) && uri.getHost() != null && uri.getRawUserInfo() == null; }
        catch (Exception ignored) { return false; }
    }
}
