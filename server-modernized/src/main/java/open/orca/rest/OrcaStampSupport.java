package open.orca.rest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.BundleMed;
import open.dolphin.infomodel.ClaimConst;
import open.dolphin.infomodel.ClaimItem;
import open.dolphin.infomodel.ModuleModel;
import open.dolphin.infomodel.OrcaInputSet;

final class OrcaStampSupport {

    private static final String INPUT_SET_SQL =
            "select inputcd,suryo1,kaisu,yukostymd,yukoedymd from tbl_inputset where hospnum=? and setcd=? order by setseq";
    private static final String TENSU_SQL =
            "select srysyukbn,name,taniname,ykzkbn from tbl_tensu where hospnum=? and srycd=? and yukostymd<=? and yukoedymd>=? order by yukoedymd desc";
    private static final String SHINRYO_KBN_START = ".";
    private static final String KBN_RP = "220";
    private static final String KBN_RAD = "700";
    private static final String KBN_GENERAL = "999";

    private OrcaStampSupport() {
    }

    static StampRequest parseStampRequest(String param, String date, EffectiveDateResolver resolver) {
        String[] params = param.split(",");
        String visitDateParam = params.length >= 3 ? params[2] : null;
        if (date != null && !date.trim().isEmpty()) {
            visitDateParam = date;
        }
        return new StampRequest(params[0], params[1], resolver.resolve(visitDateParam));
    }

    static ArrayList<ModuleModel> loadStampModules(
            Connection connection,
            int hospNum,
            StampRequest request,
            StampFactory stampFactory,
            DebugSink debug) throws SQLException {
        ArrayList<OrcaInputSet> inputSets = loadActiveInputSets(connection, hospNum, request, debug);
        ArrayList<ModuleModel> modules = new ArrayList<>();
        if (inputSets.isEmpty()) {
            return modules;
        }
        try (PreparedStatement tensu = connection.prepareStatement(TENSU_SQL)) {
            BundleDolphin currentBundle = null;
            for (OrcaInputSet inputSet : inputSets) {
                String inputCode = inputSet.getInputCd();
                debug.log("inputcd = " + inputCode);
                if (inputCode.startsWith(SHINRYO_KBN_START)) {
                    ModuleModel stamp = stampFactory.create(request.stampName(), inputCode);
                    if (stamp != null) {
                        currentBundle = (BundleDolphin) stamp.getModel();
                        modules.add(stamp);
                    }
                    debug.log("created stamp " + inputCode);
                    continue;
                }

                tensu.setInt(1, hospNum);
                tensu.setString(2, inputCode);
                tensu.setString(3, request.effectiveDate());
                tensu.setString(4, request.effectiveDate());
                debug.log(tensu.toString());

                try (ResultSet rs = tensu.executeQuery()) {
                    if (!rs.next()) {
                        continue;
                    }
                    TensuRow row = new TensuRow(inputCode, rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4));
                    debug.log("got from tbl_tensu");
                    currentBundle = appendInputSet(modules, currentBundle, request.stampName(), inputSet, row, stampFactory, debug);
                }
            }
        }
        return modules;
    }

    private static ArrayList<OrcaInputSet> loadActiveInputSets(
            Connection connection,
            int hospNum,
            StampRequest request,
            DebugSink debug) throws SQLException {
        ArrayList<OrcaInputSet> list = new ArrayList<>();
        try (PreparedStatement statement = connection.prepareStatement(INPUT_SET_SQL)) {
            statement.setInt(1, hospNum);
            statement.setString(2, request.setCd());
            debug.log(statement.toString());
            try (ResultSet rs = statement.executeQuery()) {
                int today = Integer.parseInt(request.effectiveDate());
                while (rs.next()) {
                    OrcaInputSet inputSet = new OrcaInputSet();
                    inputSet.setInputCd(rs.getString(1));
                    inputSet.setSuryo1(rs.getFloat(2));
                    inputSet.setKaisu(rs.getInt(3));
                    debug.log("got from set table");
                    debug.log("getInputCd = " + inputSet.getInputCd());
                    debug.log("getSuryo1 = " + inputSet.getSuryo1());
                    debug.log("getKaisu = " + inputSet.getKaisu());

                    String from = rs.getString(4);
                    String to = rs.getString(5);
                    debug.log("st = " + from);
                    debug.log("ed = " + to);
                    if (!isEffective(from, to, today)) {
                        continue;
                    }
                    list.add(inputSet);
                }
            }
        }
        return list;
    }

    private static boolean isEffective(String from, String to, int today) {
        if (from == null || to == null) {
            return false;
        }
        try {
            int start = Integer.parseInt(from);
            int end = Integer.parseInt(to);
            return start <= today && today <= end;
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private static BundleDolphin appendInputSet(
            ArrayList<ModuleModel> modules,
            BundleDolphin bundle,
            String stampName,
            OrcaInputSet inputSet,
            TensuRow row,
            StampFactory stampFactory,
            DebugSink debug) {
        String code = row.code();
        ClaimItem item = new ClaimItem();
        item.setCode(code);
        item.setName(row.name());
        item.setNumber(String.valueOf(inputSet.getSuryo1()));
        item.setClassCodeSystem(ClaimConst.SUBCLASS_CODE_ID);

        debug.log("code = " + row.code());
        debug.log("kbn = " + row.kbn());
        debug.log("name = " + row.name());
        debug.log("number = " + item.getNumber());
        debug.log("unit = " + row.unit());

        if (code.startsWith(ClaimConst.SYUGI_CODE_START)) {
            debug.log("item is tech");
            item.setClassCode(String.valueOf(ClaimConst.SYUGI));
            bundle = ensureBundle(modules, bundle, stampName, row.kbn(), stampFactory);
            return addItem(bundle, item, inputSet);
        }
        if (code.startsWith(ClaimConst.YAKUZAI_CODE_START)) {
            debug.log("item is medicine");
            item.setClassCode(String.valueOf(ClaimConst.YAKUZAI));
            item.setNumberCode(ClaimConst.YAKUZAI_TOYORYO);
            item.setNumberCodeSystem(ClaimConst.NUMBER_CODE_ID);
            item.setUnit(row.unit());
            if (bundle == null) {
                String receiptCode = ClaimConst.YKZ_KBN_NAIYO.equals(row.ykz()) ? ClaimConst.RECEIPT_CODE_NAIYO : ClaimConst.RECEIPT_CODE_GAIYO;
                bundle = ensureBundle(modules, null, stampName, receiptCode, stampFactory);
            }
            return addItem(bundle, item, inputSet);
        }
        if (code.startsWith(ClaimConst.ZAIRYO_CODE_START)) {
            debug.log("item is material");
            item.setClassCode(String.valueOf(ClaimConst.ZAIRYO));
            item.setNumberCode(ClaimConst.ZAIRYO_KOSU);
            item.setNumberCodeSystem(ClaimConst.NUMBER_CODE_ID);
            item.setUnit(row.unit());
            bundle = ensureBundle(modules, bundle, stampName, KBN_GENERAL, stampFactory);
            return addItem(bundle, item, inputSet);
        }
        if (code.startsWith(ClaimConst.ADMIN_CODE_START)) {
            debug.log("item is administration");
            bundle = ensureBundle(modules, bundle, stampName, KBN_RP, stampFactory);
            if (bundle instanceof BundleMed) {
                debug.log("cur bundle is BundleMed");
                bundle.setAdmin(row.name());
                bundle.setAdminCode(code);
                bundle.setBundleNumber(String.valueOf(inputSet.getKaisu()));
            } else if (bundle != null) {
                debug.log("cur bundle is ! BundleMed");
                bundle.addClaimItem(item);
            }
            return bundle;
        }
        if (code.startsWith(ClaimConst.RBUI_CODE_START)) {
            debug.log("item is rad loc.");
            item.setClassCode(String.valueOf(ClaimConst.SYUGI));
            bundle = ensureBundle(modules, bundle, stampName, KBN_RAD, stampFactory);
            return addItem(bundle, item, inputSet);
        }
        debug.log("item is other");
        bundle = ensureBundle(modules, bundle, stampName, KBN_GENERAL, stampFactory);
        return addItem(bundle, item, inputSet);
    }

    private static BundleDolphin ensureBundle(
            ArrayList<ModuleModel> modules,
            BundleDolphin bundle,
            String stampName,
            String classCode,
            StampFactory stampFactory) {
        if (bundle != null) {
            return bundle;
        }
        ModuleModel stamp = stampFactory.create(stampName, classCode);
        if (stamp == null) {
            return null;
        }
        modules.add(stamp);
        return (BundleDolphin) stamp.getModel();
    }

    private static BundleDolphin addItem(BundleDolphin bundle, ClaimItem item, OrcaInputSet inputSet) {
        if (bundle == null) {
            return null;
        }
        if (inputSet.getKaisu() > 0) {
            bundle.setBundleNumber(String.valueOf(inputSet.getKaisu()));
        }
        bundle.addClaimItem(item);
        return bundle;
    }

    record StampRequest(String setCd, String stampName, String effectiveDate) {
    }

    @FunctionalInterface
    interface EffectiveDateResolver {
        String resolve(String visitDateParam);
    }

    @FunctionalInterface
    interface StampFactory {
        ModuleModel create(String stampName, String code);
    }

    @FunctionalInterface
    interface DebugSink {
        void log(String message);
    }

    private record TensuRow(String code, String kbn, String name, String unit, String ykz) {
    }
}
