package open.dolphin.mbean;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 *
 * @author ishizaka
 */
class ConvData {

    String m_sAsc;
    String m_sKana;

    ConvData(String strAC, String strKana) {
        m_sAsc = strAC;
        m_sKana = strKana;
    }

    String GetAsc() {
        return m_sAsc;
    }

    String GetKana() {
        return m_sKana;
    }
}

public class KanaToAscii {

    List<ConvData> m_DataAry;

    public KanaToAscii() {
        m_DataAry = new ArrayList<ConvData>();
        registerCoreKana();
        registerExtendedKana();
        registerSupplementalKana();
        registerVoicedKana();
        registerAsciiUppercase();
        registerAsciiLowercaseHead();
        registerAsciiLowercaseTail();
    }

    private void addMapping(String ascii, String kana) {
        m_DataAry.add(new ConvData(ascii, kana));
    }

    private void registerCoreKana() {
        addMapping("A", "ア");
        addMapping("I", "イ");
        addMapping("U", "ウ");
        addMapping("E", "エ");
        addMapping("O", "オ");
        addMapping("KA", "カ");
        addMapping("KI", "キ");
        addMapping("KU", "ク");
        addMapping("KE", "ケ");
        addMapping("KO", "コ");
        addMapping("SA", "サ");
        addMapping("SHI", "シ");
        addMapping("SU", "ス");
        addMapping("SE", "セ");
        addMapping("SO", "ソ");
        addMapping("TA", "タ");
        addMapping("CHI", "チ");
        addMapping("TSU", "ツ");
        addMapping("TE", "テ");
        addMapping("TO", "ト");
        addMapping("NA", "ナ");
        addMapping("NI", "ニ");
        addMapping("NU", "ヌ");
        addMapping("NE", "ネ");
        addMapping("NO", "ノ");
        addMapping("HA", "ハ");
        addMapping("HI", "ヒ");
        addMapping("FU", "フ");
        addMapping("HE", "へ");
        addMapping("HO", "ホ");
        addMapping("MA", "マ");
        addMapping("MI", "ミ");
        addMapping("MU", "ム");
        addMapping("ME", "メ");
        addMapping("MO", "モ");
        addMapping("YA", "ヤ");
        addMapping("YU", "ユ");
        addMapping("YO", "ヨ");
        addMapping("RA", "ラ");
        addMapping("RI", "リ");
        addMapping("RU", "ル");
        addMapping("RE", "レ");
        addMapping("RO", "ロ");
        addMapping("WA", "ワ");
        addMapping("WO", "ヲ");
        addMapping("N", "ン");
        addMapping("$", "ｯ");
        addMapping("KWA", "クァ");
        addMapping("KWI", "クィ");
        addMapping("KWU", "クゥ");
        addMapping("KWE", "クェ");
        addMapping("KWO", "クォ");
    }

    private void registerExtendedKana() {
        addMapping("FA", "ファ");
        addMapping("FI", "フィ");
        addMapping("FU", "フゥ");
        addMapping("FE", "フェ");
        addMapping("FO", "フォ");
        addMapping("FYA", "フャ");
        addMapping("FYU", "フュ");
        addMapping("FYO", "フョ");
        addMapping("KYA", "キャ");
        addMapping("KYI", "キィ");
        addMapping("KYU", "キュ");
        addMapping("KYE", "キェ");
        addMapping("KYO", "キョ");
        addMapping("SHA", "シャ");
        addMapping("SHU", "シュ");
        addMapping("SHE", "シェ");
        addMapping("SHO", "ショ");
        addMapping("CHA", "チャ");
        addMapping("TYI", "チィ");
        addMapping("CHU", "チュ");
        addMapping("TYE", "チェ");
        addMapping("CHO", "チヨ");
    }

    private void registerSupplementalKana() {
        addMapping("NYA", "ニャ");
        addMapping("NYI", "ニィ");
        addMapping("NYU", "ニュ");
        addMapping("NYE", "ニェ");
        addMapping("NYO", "ニョ");
        addMapping("HYA", "ヒャ");
        addMapping("HYI", "ヒィ");
        addMapping("HYU", "ヒュ");
        addMapping("HYE", "ヒェ");
        addMapping("HYO", "ヒョ");
        addMapping("MYA", "ミャ");
        addMapping("MYI", "ミィ");
        addMapping("MYU", "ミュ");
        addMapping("MYE", "ミェ");
        addMapping("MYO", "ミョ");
        addMapping("RYA", "リャ");
        addMapping("RYI", "リィ");
        addMapping("RYU", "リュ");
        addMapping("RYE", "リェ");
        addMapping("RYO", "リョ");
        addMapping("WI", "ウィ");
        addMapping("WE", "ウェ");
    }

    private void registerVoicedKana() {
        addMapping("GA", "ガ");
        addMapping("GI", "ギ");
        addMapping("GU", "グ");
        addMapping("VU", "ｳﾞ");
        addMapping("GE", "ゲ");
        addMapping("GO", "ゴ");
        addMapping("ZA", "ザ");
        addMapping("JI", "ジ");
        addMapping("ZU", "ズ");
        addMapping("ZE", "ゼ");
        addMapping("ZO", "ゾ");
        addMapping("DA", "ダ");
        addMapping("DI", "ヂ");
        addMapping("DU", "ヅ");
        addMapping("DE", "デ");
        addMapping("DO", "ド");
        addMapping("BA", "バ");
        addMapping("BI", "ビ");
        addMapping("BU", "ブ");
        addMapping("BE", "ベ");
        addMapping("BO", "ボ");
        addMapping("PA", "パ");
        addMapping("PI", "ピ");
        addMapping("PU", "プ");
        addMapping("PE", "ペ");
        addMapping("PO", "ポ");
        addMapping("GWA", "グァ");
        addMapping("GWI", "グィ");
        addMapping("GWU", "グゥ");
        addMapping("GWE", "グェ");
        addMapping("GWO", "グォ");
        addMapping("GYA", "ギャ");
        addMapping("GYI", "ギィ");
        addMapping("GYU", "ギュ");
        addMapping("GYE", "ギェ");
        addMapping("GYO", "ギョ");
        addMapping("JA", "ジャ");
        addMapping("ZYI", "ジィ");
        addMapping("JU", "ジュ");
        addMapping("JE", "ジェ");
        addMapping("JO", "ジョ");
        addMapping("DYA", "ヂァ");
        addMapping("DYI", "ヂィ");
        addMapping("DYU", "ヂョ");
        addMapping("DYE", "ヂェ");
        addMapping("DYO", "ヂョ");
        addMapping("BYA", "ビャ");
        addMapping("BYI", "ビィ");
        addMapping("BYU", "ビュ");
        addMapping("BYE", "ビェ");
        addMapping("BYO", "ビョ");
        addMapping("VA", "ヴァ");
        addMapping("VI", "ヴィ");
        addMapping("VE", "ヴェ");
        addMapping("VO", "ヴォ");
        addMapping("VYA", "ヴャ");
        addMapping("VYI", "ヴｨ");
        addMapping("VYU", "ヴュ");
        addMapping("VYE", "ヴェ");
        addMapping("VYO", "ヴョ");
        addMapping("PYA", "ピャ");
        addMapping("PYI", "ピィ");
        addMapping("PYU", "ピュ");
        addMapping("PYE", "ピェ");
        addMapping("PYO", "ペョ");
    }

    private void registerAsciiUppercase() {
        addMapping(" ", " ");
        addMapping("", "ｰ");
        addMapping("0", "０");
        addMapping("1", "１");
        addMapping("2", "２");
        addMapping("3", "３");
        addMapping("4", "４");
        addMapping("5", "５");
        addMapping("6", "６");
        addMapping("7", "７");
        addMapping("8", "８");
        addMapping("9", "９");
        addMapping("A", "Ａ");
        addMapping("B", "Ｂ");
        addMapping("C", "Ｃ");
        addMapping("D", "Ｄ");
        addMapping("E", "Ｅ");
        addMapping("F", "Ｆ");
        addMapping("G", "Ｇ");
        addMapping("H", "Ｈ");
        addMapping("I", "Ｉ");
        addMapping("J", "Ｊ");
        addMapping("K", "Ｋ");
        addMapping("L", "Ｌ");
        addMapping("M", "Ｍ");
        addMapping("N", "Ｎ");
        addMapping("O", "Ｏ");
        addMapping("P", "Ｐ");
        addMapping("Q", "Ｑ");
        addMapping("R", "Ｒ");
        addMapping("S", "Ｓ");
        addMapping("T", "Ｔ");
        addMapping("U", "Ｕ");
        addMapping("V", "Ｖ");
        addMapping("W", "Ｗ");
        addMapping("X", "Ｘ");
        addMapping("Y", "Ｙ");
        addMapping("Z", "Ｚ");
    }

    private void registerAsciiLowercaseHead() {
        addMapping("a", "ａ");
        addMapping("b", "ｂ");
        addMapping("c", "ｃ");
        addMapping("d", "ｄ");
        addMapping("e", "ｅ");
        addMapping("f", "ｆ");
        addMapping("g", "ｇ");
        addMapping("h", "ｈ");
        addMapping("i", "ｉ");
        addMapping("j", "ｊ");
        addMapping("k", "ｋ");
        addMapping("l", "ｌ");
        addMapping("m", "ｍ");
    }

    private void registerAsciiLowercaseTail() {
        addMapping("n", "ｎ");
        addMapping("o", "ｏ");
        addMapping("p", "ｐ");
        addMapping("q", "ｑ");
        addMapping("r", "ｒ");
        addMapping("s", "ｓ");
        addMapping("t", "ｔ");
        addMapping("u", "ｕ");
        addMapping("v", "ｖ");
        addMapping("w", "ｗ");
        addMapping("x", "ｘ");
        addMapping("y", "ｙ");
        addMapping("z", "ｚ");
    }

    void KanaToAscii_Free() {
        m_DataAry.clear();
    }

    int GetSize() {
        return m_DataAry.size();
    }

    String GetAsc(int nPos) {
        if (nPos < 0 || nPos > GetSize() - 1) {
//		return CString( "" );
            String sRet = null;
            return sRet; // 02.05.31 kin
        }
        return m_DataAry.get(nPos).GetAsc();
    }

    String GetKana(int nPos) {
        if (nPos < 0 || nPos > GetSize() - 1) {
//		return CString( "" );
            String sRet = null;
            return sRet; // 02.05.31 kin
        }
        return m_DataAry.get(nPos).GetKana();
    }

    public String CHGKanatoASCII(String strKana, String strASCII) {

        String strCHG = "";
        boolean bTrue = false;
        int nLen = 0;
        ConvData dic;


        for (nLen = 0; nLen < strKana.length(); nLen++) {
            String strSub = "";
            bTrue = false;
            if (nLen + 1 < strKana.length()) {
                strSub = strKana.substring((nLen), nLen + 2);
                for (ConvData data : m_DataAry) {
                    dic = data;
                    if (dic.m_sKana.equals(strSub)) {
                        strCHG += dic.m_sAsc;
                        bTrue = true;
                        break;
                    }
                }
                if (bTrue) {
                    nLen += 1;
                    continue;
                }

            }
            strSub = strKana.substring((nLen), nLen + 1);
            for (ConvData data : m_DataAry) {
                dic = data;
                if (dic.m_sKana.equals(strSub)) {
                    strCHG += dic.m_sAsc;
                    bTrue = true;
                    break;
                }
            }
            if (!bTrue) {
                //return -1;
                //return null;
                // カナ/英数字以外の文字は?に変換する
                strCHG += "?";
            }

        }
        byte[] ChgByte = strCHG.getBytes(StandardCharsets.US_ASCII);
        for (nLen = 0; nLen < ChgByte.length; nLen++) {
            if (ChgByte[nLen] == '$') {
                if (nLen + 1 < ChgByte.length) {
                    if (ChgByte[nLen + 1] != ' ') {
                        ChgByte[nLen] = ChgByte[nLen + 1];
                        if (ChgByte[nLen] == 'C') {
                            ChgByte[nLen] = 'T';
                        }
                    }
                }
            } else if (ChgByte[nLen] == 'N' && nLen + 1 < ChgByte.length) {
                if (ChgByte[nLen + 1] == 'B' || ChgByte[nLen + 1] == 'M' || ChgByte[nLen + 1] == 'P') {
                    ChgByte[nLen] = 'M';
                }
            }
        }
        String sAsc = new String(ChgByte, StandardCharsets.US_ASCII); //    

        sAsc.replace("$", "");
        sAsc.replace("OO", "OH");
        sAsc.replace("OU", "OH");
        sAsc.replace("AA", "A");
        sAsc.replace("II", "I");
        sAsc.replace("UU", "U");
        sAsc.replace("EE", "E");

        //strASCII = sAsc;

        return sAsc;
    }

    public static void main(String[] args) {
        KanaToAscii ka = new KanaToAscii();
        String result = ka.CHGKanatoASCII("フナバシ ケンジ", "");
    }
}
