package open.dolphin.converter;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.StringReader;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.nio.charset.StandardCharsets;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeUtility;
import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;
import org.xml.sax.Attributes;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

/**
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
public final class PlistParser {

    private static final int TT_KEY         = 0;
    private static final int TT_STRING      = 1;
    private static final int TT_INTEGER     = 2;
    private static final int TT_REAL        = 3;
    private static final int TT_DATE        = 4;
    private static final int TT_DATA        = 5;
    private static final int TT_TRUE        = 6;
    private static final int TT_FALSE       = 7;
    private static final int TT_DICT        = 8;
    private static final int TT_ARRAY       = 9;

    private static final String XML_LT = "&lt;";
    private static final String XML_GT = "&gt;";
    private static final String XML_AND = "&amp;";
    private static final String XML_QUOT = "&quot;";
    private static final String XML_APOS = "&apos;";

    private static final String STRING_LT = "<";
    private static final String STRING_GT = ">";
    private static final String STRING_AND = "&";
    private static final String STRING_QUOT = "\"";
    private static final String STRING_APOS = "'";

    private static final String DICT = "dict";
    private static final String ARRAY = "array";

    private static final String[] ELEMENTS =
        new String[]{"key", "string", "integer", "real", "date", "data", "true", "false", DICT, ARRAY};

    private static final String MODEL_PACKAGE = "open.dolphin.infomodel.";

    private static final String SET = "set";

    //private static SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    private static final String BASE64 = "base64";

    private static final boolean DEBUG = false;

    private List<Object> stack;

    private String currentKey;

    private StringBuilder characterBuffer;

    private int currentParsing;

    public PlistParser() {
        stack = new ArrayList<Object>(10);
    }

    /**
     * 引数のplistからInfoModel オブジェクトを生成する。
     * @param plist XMLデータ
     * @return InfoModelオブジェクト
     */
    public Object parse(String plist) {
        SAXParserFactory factory = SAXParserFactory.newInstance();
        StringReader reader = new StringReader(plist);

        try {
            SAXParser saxParser = factory.newSAXParser();
            saxParser.parse(new InputSource(reader), new PlistContentHandler());
            reader.close();
        } catch (Exception e) {
            System.err.println("Exception at convert(): " + e.getMessage());
            clearStack();
        }

        return !stack.isEmpty() ? stack.remove(0) : null;
    }

    private final class PlistContentHandler extends DefaultHandler {

        @Override
        public void startElement(String uri, String localName, String qName, Attributes attributes)
                throws SAXException {
            handleStartElement(qName);
        }

        @Override
        public void endElement(String uri, String localName, String qName) throws SAXException {
            handleEndElement(qName);
        }

        @Override
        public void characters(char[] ch, int start, int length) throws SAXException {
            appendCharacters(ch, start, length);
        }
    }

    private void handleStartElement(String qName) {
        if (DICT.equals(qName)) {
            if (currentKey != null) {
                Object obj = createObject(currentKey);
                if (!stack.isEmpty()) {
                    storeObject(currentKey, obj);
                }
                stack.add(0, obj);
            }
        } else if (ARRAY.equals(qName)) {
            List list = new ArrayList();
            if (!stack.isEmpty()) {
                storeList(currentKey, list);
            }
            stack.add(0, list);
        }
    }

    private void handleEndElement(String qName) {
        currentParsing = resolveCurrentParsing(qName);
        String value = builderToString();

        switch (currentParsing) {
            case TT_KEY:
                currentKey = value != null ? value : null;
                break;
            case TT_STRING:
                if (value != null && !value.isEmpty()) {
                    storeString(currentKey, unescapeXmlValue(value));
                }
                currentKey = null;
                break;
            case TT_INTEGER:
                if (value != null) {
                    storeInteger(currentKey, value);
                }
                currentKey = null;
                break;
            case TT_REAL:
                if (value != null) {
                    storeReal(currentKey, value);
                }
                currentKey = null;
                break;
            case TT_DATE:
                if (value != null) {
                    storeDate(currentKey, parseDate(value));
                }
                currentKey = null;
                break;
            case TT_DATA:
                if (value != null) {
                    try {
                        storeByte(currentKey, base64Decode(value.getBytes(StandardCharsets.UTF_8)));
                    } catch (Exception e) {
                        System.err.println("TT_DATA Exception: " + e.getMessage());
                    }
                }
                currentKey = null;
                break;
            case TT_TRUE:
                storeBoolean(currentKey, true);
                currentKey = null;
                break;
            case TT_FALSE:
                storeBoolean(currentKey, false);
                currentKey = null;
                break;
            case TT_DICT:
            case TT_ARRAY:
                removeStackHeadIfNeeded();
                currentKey = null;
                break;
            default:
                break;
        }
    }

    private void appendCharacters(char[] ch, int start, int length) {
        String parsedCharacterData = currentParsing == TT_DATA
                ? new String(ch, start, length).trim()
                : new String(ch, start, length);

        if (characterBuffer == null) {
            characterBuffer = new StringBuilder();
        }
        characterBuffer.append(parsedCharacterData);
    }

    private int resolveCurrentParsing(String qName) {
        for (int i = 0; i < ELEMENTS.length; i++) {
            if (qName.equals(ELEMENTS[i])) {
                return i;
            }
        }
        return currentParsing;
    }

    private String unescapeXmlValue(String value) {
        String escaped = value.replaceAll(XML_LT, STRING_LT);
        escaped = escaped.replaceAll(XML_GT, STRING_GT);
        escaped = escaped.replaceAll(XML_AND, STRING_AND);
        escaped = escaped.replaceAll(XML_QUOT, STRING_QUOT);
        return escaped.replaceAll(XML_APOS, STRING_APOS);
    }

    private void removeStackHeadIfNeeded() {
        if (stack.size() > 1) {
            stack.remove(0);
        }
    }

    private void clearStack() {
        stack.clear();
    }

    /**
     * 引数のクラス名からInfoModelオブジェクトを生成する。
     * @param clsName クラス名
     * @return InfoModelオブジェクト
     */
    private Object createObject(String clsName) {

        Object ret;

        try {
            StringBuilder sb = new StringBuilder();
            sb.append(MODEL_PACKAGE);
            sb.append(clsName.substring(0,1).toUpperCase());
            sb.append(clsName.substring(1));
            String fullName = sb.toString();

            ret = Class.forName(fullName).newInstance();

        } catch (Exception e) {
            debug(e.getMessage());
            ret = null;
        }

        return ret;
    }
        
    private void storeBoolean(String name, Object value) {
        
        if (name != null && value != null) { 
            setValue(name, value, Boolean.TYPE);
        }
    }

    private void storeByte(String name, byte[] bytes) {

        if (name != null && bytes != null) {
            setValue(name, bytes, bytes.getClass());
        }
    }

    private void storeString(String name, Object value) {

        if (name != null && value != null) {
            if (currentTargetIsList()) {
                addToList(value);
            } else {
                setValue(name, value, String.class);
            }
        }
    }

    private void storeDate(String name, Object value) {

        if (name != null && value != null) {
            if (currentTargetIsList()) {
                addToList(value);
            } else {
                setValue(name, value, Date.class);
            }
        }
    }

    private void storeObject(String name, Object value) {

        if (name != null && value != null) {
            if (currentTargetIsList()) {
                addToList(value);
            } else {
                setValue(name, value, value.getClass());
            }
        }
    }

    private void storeList(String name, Object list) {

        if (list != null) {
            if (currentTargetIsList()) {
                addToList(list);
            } else if (name!=null) {
                setValue(name, list, List.class);
            }
        }
    }

    /**
     * Stackの先頭要素オブジェクトにプロパティ値を設定する。
     * @param name プロパティ名
     * @param value プロパティ値
     * @param cls プロパティクラス
     */
    private void setValue(String name, Object value, Class cls) {

        try {
            Object target = stack.get(0);

            String setter = toSetter(name);

            Method mth = target.getClass().getMethod(setter, cls);
            mth.invoke(target, value);

        } catch (ReflectiveOperationException | SecurityException e) {
            //System.err.println("Exception setValue: " + e.getMessage());
            debug(e.getMessage());
        }
    }
    
    private void storeInteger(String name, String value) {

        Object target = stack.get(0);

        String setter = toSetter(name);

        try {
            long parsed = Long.parseLong(value);
            Method mth = target.getClass().getMethod(setter, long.class);
            mth.invoke(target, parsed);
            return;
        } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
            debug(e.getMessage());
        } catch (NumberFormatException e) {
            debug(e.getMessage());
            return;
        }

        try {
            int parsed = Integer.parseInt(value);
            Method mth = target.getClass().getMethod(setter, int.class);
            mth.invoke(target, parsed);
        } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
            debug(e.getMessage());
        } catch (NumberFormatException e) {
            debug(e.getMessage());
        }
    }

    private void storeReal(String name, String value) {

        Object target = stack.get(0);

        String setter = toSetter(name);

        try {
            float parsed = Float.parseFloat(value);
            Method mth = target.getClass().getMethod(setter, float.class);
            mth.invoke(target, parsed);
            return;
        } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
            debug(e.getMessage());
        } catch (NumberFormatException e) {
            debug(e.getMessage());
            return;
        }

        try {
            double parsed = Double.parseDouble(value);
            Method mth = target.getClass().getMethod(setter, double.class);
            mth.invoke(target, parsed);
        } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
            debug(e.getMessage());
        } catch (NumberFormatException e) {
            debug(e.getMessage());
        }
    }

    private void addToList(Object value) {

        try {
            ArrayList target = (ArrayList)stack.get(0);
            target.add(value);

        } catch (Exception e) {
            System.err.println("Exception addToList: " + e.getMessage());
        }
    }

    private boolean currentTargetIsList() {

        Object target = stack.get(0);
        return (target instanceof ArrayList) ? true : false;
    }

    private String toSetter(String name) {
        StringBuilder sb = new StringBuilder();
        sb.append(SET);
        sb.append(name.substring(0,1).toUpperCase());
        sb.append(name.substring(1));
        String setter = sb.toString();
        return setter;
    }

    private String builderToString() {

        String ret = null;

        if (characterBuffer != null && characterBuffer.length() > 0) {
            ret = characterBuffer.toString();
            characterBuffer = null;
        }

        return ret;
    }

    private static Date parseDate(String dateStr) {

        Date ret = null;

        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            ret = sdf.parse(dateStr);
        } catch (ParseException e) {
            debug(e.getMessage());
        }

        return ret;
    }

//    public static byte[] base64Encode(byte[] value) throws IOException, MessagingException {
//        ByteArrayOutputStream baos = new ByteArrayOutputStream();
//        OutputStream b64os = MimeUtility.encode(baos, BASE64);
//        b64os.write(value);
//        b64os.close();
//        return baos.toByteArray();
//    }
//
//    public static byte[] base64Decode(byte[] value) throws IOException, MessagingException {
//        ByteArrayInputStream bais = new ByteArrayInputStream(value);
//        InputStream b64is = MimeUtility.decode(bais, BASE64);
//        byte[] tmp = new byte[value.length];
//        int n = b64is.read(tmp);
//        byte[] res = new byte[n];
//        System.arraycopy(tmp, 0, res, 0, n);
//        return res;
//    }
    
    public static byte[] base64Encode(byte[] value) throws IOException, MessagingException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        OutputStream b64os = MimeUtility.encode(baos, BASE64);
        b64os.write(value);
        b64os.close();
        return baos.toByteArray();
    }

    public static byte[] base64Decode(byte[] value) throws IOException, MessagingException {
        ByteArrayInputStream bais = new ByteArrayInputStream(value);
        InputStream b64is = MimeUtility.decode(bais, BASE64);
        byte[] tmp = new byte[value.length];
        int n = b64is.read(tmp);
        byte[] res = new byte[n];
        System.arraycopy(tmp, 0, res, 0, n);
        return res;
    }

    private static void debug(String str) {
        if (DEBUG) {
            System.err.println(str);
        }
    }
}
