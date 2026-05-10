package open.dolphin.orca.service;

import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.io.StringReader;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseComponent;
import open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseSupplement;
import open.dolphin.rest.dto.orca.DiseaseImportResponse.DiseaseEntry;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@ApplicationScoped
public class DiseaseProjectionService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd")
            .withLocale(Locale.JAPAN)
            .withZone(ZoneId.systemDefault());
    private static final DateTimeFormatter ORCA_DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE;
    public static final String DISEASE_GET_QUERY = "class=01";

    public DiseaseImportResponse buildImportResponse(
            List<RegisteredDiagnosisModel> diagnoses,
            String runId,
            String patientId,
            Date fromDate,
            Date toDate) {
        DiseaseImportResponse response = new DiseaseImportResponse();
        response.setApiResult("00");
        response.setApiResultMessage("処理終了");
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBaseDate(formatDate(fromDate));
        List<RegisteredDiagnosisModel> safeDiagnoses = diagnoses != null ? diagnoses : List.of();
        safeDiagnoses.stream()
                .filter(model -> model.getStarted() == null || toDate == null || !model.getStarted().after(toDate))
                .map(this::toEntry)
                .forEach(response::addDisease);
        if (response.getDiseases() == null) {
            response.setDiseases(new ArrayList<>());
        }
        return response;
    }

    public String buildDiseaseGetRequestXml(String patientId, LocalDate baseDate) {
        return buildDiseaseGetRequestXml(patientId, baseDate, false);
    }

    public String buildDiseaseGetRequestXml(String patientId, LocalDate baseDate, boolean includeEnded) {
        String safePatientId = safeXml(patientId);
        String safeBaseDate = ORCA_DATE_FORMAT.format(baseDate != null ? baseDate : LocalDate.now());
        return "<data>"
                + "<disease_inforeq type=\"record\">"
                + "<Patient_ID type=\"string\">" + safePatientId + "</Patient_ID>"
                + "<Base_Date type=\"string\">" + safeBaseDate + "</Base_Date>"
                + (includeEnded ? "<Select_Mode type=\"string\">All</Select_Mode>" : "")
                + "</disease_inforeq>"
                + "</data>";
    }

    public DiseaseImportResponse buildMirrorResponseFromOrca(
            OrcaTransportResult result,
            String runId,
            String patientId,
            Date fromDate,
            Date toDate) {
        DiseaseImportResponse response = new DiseaseImportResponse();
        response.setRunId(runId);
        response.setPatientId(patientId);
        response.setBaseDate(formatDate(fromDate));
        response.setOrcaMirrorStatus("unavailable");
        int status = result != null ? result.getStatus() : 503;
        if (status < 200 || status >= 300) {
            response.setApiResult("transport_error");
            response.setApiResultMessage("orca_disease_mirror_unavailable");
            return response;
        }
        try {
            Document document = parseXml(result.getBody());
            String apiResult = firstText(document, "Api_Result");
            response.setApiResult(apiResult);
            response.setApiResultMessage("orca_disease_mirror_result");
            if ("21".equals(apiResult)) {
                response.setOrcaMirrorStatus("connected");
                response.setApiResultMessage("orca_disease_mirror_empty");
                response.setDiseases(new ArrayList<>());
                return response;
            }
            if (apiResult != null && !apiResult.matches("0+")) {
                return response;
            }
            List<RegisteredDiagnosisModel> diagnoses = parseDiseaseEntries(document);
            DiseaseImportResponse projected = buildImportResponse(diagnoses, runId, patientId, fromDate, toDate);
            projected.setOrcaMirrorStatus("connected");
            projected.setApiResult(apiResult != null ? apiResult : "00");
            projected.setApiResultMessage("orca_disease_mirror_connected");
            return projected;
        } catch (Exception ex) {
            response.setApiResult("parser_error");
            response.setApiResultMessage("orca_disease_mirror_unavailable");
            return response;
        }
    }

    public void applyMirrorDiffState(List<Map<String, Object>> localItems, List<DiseaseEntry> mirrorEntries) {
        if (localItems == null || localItems.isEmpty() || mirrorEntries == null || mirrorEntries.isEmpty()) {
            return;
        }
        Map<String, Boolean> mirrorKeys = new LinkedHashMap<>();
        for (DiseaseEntry entry : mirrorEntries) {
            mirrorKeys.put(normalizedDiseaseKey(entry.getDiagnosisName(), entry.getDiagnosisCode()), Boolean.TRUE);
        }
        for (Map<String, Object> item : localItems) {
            String localName = item.get("diagnosisName") instanceof String value ? value : null;
            String localCode = item.get("diagnosisCode") instanceof String value ? value : null;
            String key = normalizedDiseaseKey(
                    localName,
                    localCode);
            if (!mirrorKeys.containsKey(key)) {
                item.put("syncState", "conflict");
                item.put("note", "ORCA側と差分があります");
            }
        }
        for (DiseaseEntry entry : mirrorEntries) {
            boolean matched = false;
            String mirrorKey = normalizedDiseaseKey(entry.getDiagnosisName(), entry.getDiagnosisCode());
            for (Map<String, Object> item : localItems) {
                String localName = item.get("diagnosisName") instanceof String value ? value : null;
                String localCode = item.get("diagnosisCode") instanceof String value ? value : null;
                String localKey = normalizedDiseaseKey(
                        localName,
                        localCode);
                if (mirrorKey.equals(localKey)) {
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                entry.setSyncState("conflict");
                entry.setNote("ORCA側と差分があります");
            }
        }
    }

    private DiseaseEntry toEntry(RegisteredDiagnosisModel model) {
        DiseaseEntry entry = new DiseaseEntry();
        entry.setDiagnosisId(model.getId());
        entry.setDiagnosisName(model.getDiagnosis());
        entry.setDisplayName(model.getDiagnosis());
        entry.setDiagnosisCode(model.getDiagnosisCode());
        entry.setDepartmentCode(model.getDepartment());
        entry.setInsuranceCombinationNumber(model.getRelatedHealthInsurance());
        entry.setStartDate(model.getStartDate());
        entry.setEndDate(model.getEnded() != null ? formatDate(model.getEnded()) : model.getEndDate());
        entry.setOutcome(model.getDiagnosisOutcomeModel() != null ? model.getDiagnosisOutcomeModel().getOutcome() : model.getOutcome());
        entry.setOrcaOutcomeReceivedCode(model.getOutcomeCodeSys());
        entry.setCategory(model.getCategory());
        entry.setSuspectedFlag(model.getCategoryDesc());
        entry.setLayer("orca-mirror");
        entry.setSyncState("none");
        entry.setSyncStatus("SYNCED");
        entry.setComponents(toDiseaseComponents(model.getTransientDiseaseComponents()));
        entry.setSupplements(toDiseaseSupplements(model.getTransientDiseaseSupplements()));
        entry.setOrcaSnapshotHash(model.getTransientOrcaSnapshotHash());
        entry.setReadOnly(Boolean.TRUE);
        entry.setCandidateOnly(Boolean.FALSE);
        return entry;
    }

    private String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return DATE_FORMAT.format(date.toInstant());
    }

    private static List<RegisteredDiagnosisModel> parseDiseaseEntries(Document document) {
        List<RegisteredDiagnosisModel> diagnoses = new ArrayList<>();
        NodeList diseaseNodes = document.getElementsByTagName("Disease_Information_child");
        if (diseaseNodes.getLength() == 0) {
            diseaseNodes = document.getElementsByTagName("Disease_Information");
        }
        for (int i = 0; i < diseaseNodes.getLength(); i++) {
            Node node = diseaseNodes.item(i);
            if (!(node instanceof Element element)) {
                continue;
            }
            String name = firstChildText(element, "Disease_Name", "DiseaseName", "byomei");
            String code = firstChildText(element, "Disease_Code", "DiseaseCode", "Disease_Single_Code", "khnbyomeicd");
            String startDate = normalizeOrcaDate(firstChildText(element, "Disease_StartDate", "Start_Date", "sryymd"));
            List<DiseaseComponent> components = parseDiseaseComponents(element);
            if (components.isEmpty() && !isBlank(code)) {
                DiseaseComponent fallback = new DiseaseComponent();
                fallback.setSeq(1);
                fallback.setComponentType(componentTypeForCode(code));
                fallback.setCode(code);
                fallback.setName(name);
                fallback.setSourceMaster("ORCA diseasegetv2");
                components = List.of(fallback);
            }
            List<DiseaseSupplement> supplements = parseDiseaseSupplements(element);
            if (isBlank(name) && isBlank(code)) {
                continue;
            }
            RegisteredDiagnosisModel model = new RegisteredDiagnosisModel();
            model.setDiagnosis(name);
            model.setDiagnosisCode(code);
            model.setStartDate(startDate);
            model.setEndDate(normalizeOrcaDate(firstChildText(element, "Disease_EndDate", "End_Date", "tenkiymd")));
            model.setDepartment(firstChildText(element, "Department_Code", "DepartmentCode", "sryka"));
            model.setCategory(firstChildText(element, "Disease_Category", "Category"));
            model.setCategoryDesc(firstChildText(element, "Disease_SuspectedFlag", "Suspected_Flag", "utagaiflg"));
            String outcomeCode = firstChildText(element, "Disease_OutCome", "Outcome", "tenkikbn");
            model.setOutcome(normalizeOutcomeCode(outcomeCode));
            model.setOutcomeCodeSys(outcomeCode);
            model.setRelatedHealthInsurance(firstChildText(element, "Insurance_Combination_Number"));
            model.setStatus("ORCA_MIRROR");
            model.setTransientDiseaseComponents(toComponentMaps(components));
            model.setTransientDiseaseSupplements(toSupplementMaps(supplements));
            model.setTransientOrcaSnapshotHash(snapshotHash(
                    firstChildText(element, "Department_Code", "DepartmentCode", "sryka"),
                    firstChildText(element, "Insurance_Combination_Number"),
                    startDate,
                    model.getEndDate(),
                    outcomeCode,
                    components,
                    supplements));
            diagnoses.add(model);
        }
        return diagnoses;
    }

    private static List<DiseaseComponent> parseDiseaseComponents(Element diseaseElement) {
        List<DiseaseComponent> components = new ArrayList<>();
        NodeList nodes = diseaseElement.getElementsByTagName("Disease_Single_child");
        for (int i = 0; i < nodes.getLength(); i++) {
            if (!(nodes.item(i) instanceof Element componentElement)) {
                continue;
            }
            String code = firstChildText(componentElement, "Disease_Single_Code", "Disease_Code", "Code");
            String name = firstChildText(componentElement, "Disease_Single_Name", "Disease_Name", "Name");
            if (isBlank(code) && isBlank(name)) {
                continue;
            }
            DiseaseComponent component = new DiseaseComponent();
            component.setSeq(components.size() + 1);
            component.setComponentType(componentTypeForCode(code));
            component.setCode(code);
            component.setName(name);
            component.setSourceMaster("ORCA diseasegetv2");
            components.add(component);
        }
        return components;
    }

    private static List<DiseaseSupplement> parseDiseaseSupplements(Element diseaseElement) {
        List<DiseaseSupplement> supplements = new ArrayList<>();
        NodeList nodes = diseaseElement.getElementsByTagName("Disease_Supplement_Single_child");
        for (int i = 0; i < nodes.getLength(); i++) {
            if (!(nodes.item(i) instanceof Element supplementElement)) {
                continue;
            }
            String code = firstChildText(supplementElement, "Disease_Supplement_Single_Code", "Supplement_Code", "Code");
            String name = firstChildText(supplementElement, "Disease_Supplement_Single_Name", "Supplement_Name", "Name");
            if (isBlank(code) && isBlank(name)) {
                continue;
            }
            DiseaseSupplement supplement = new DiseaseSupplement();
            supplement.setSeq(supplements.size() + 1);
            supplement.setSupplementCode(code);
            supplement.setSupplementName(name);
            supplements.add(supplement);
        }
        return supplements;
    }

    private static List<Map<String, String>> toComponentMaps(List<DiseaseComponent> components) {
        List<Map<String, String>> maps = new ArrayList<>();
        for (DiseaseComponent component : components != null ? components : List.<DiseaseComponent>of()) {
            Map<String, String> map = new LinkedHashMap<>();
            map.put("seq", component.getSeq() != null ? String.valueOf(component.getSeq()) : "");
            map.put("componentType", component.getComponentType());
            map.put("code", component.getCode());
            map.put("name", component.getName());
            map.put("sourceMaster", component.getSourceMaster());
            map.put("validFrom", component.getValidFrom());
            map.put("validTo", component.getValidTo());
            map.put("condition", component.getCondition());
            maps.add(map);
        }
        return maps;
    }

    private static List<DiseaseComponent> toDiseaseComponents(List<Map<String, String>> maps) {
        List<DiseaseComponent> components = new ArrayList<>();
        for (Map<String, String> map : maps != null ? maps : List.<Map<String, String>>of()) {
            DiseaseComponent component = new DiseaseComponent();
            component.setSeq(parseInteger(map.get("seq")));
            component.setComponentType(map.get("componentType"));
            component.setCode(map.get("code"));
            component.setName(map.get("name"));
            component.setSourceMaster(map.get("sourceMaster"));
            component.setValidFrom(map.get("validFrom"));
            component.setValidTo(map.get("validTo"));
            component.setCondition(map.get("condition"));
            components.add(component);
        }
        return components;
    }

    private static List<Map<String, String>> toSupplementMaps(List<DiseaseSupplement> supplements) {
        List<Map<String, String>> maps = new ArrayList<>();
        for (DiseaseSupplement supplement : supplements != null ? supplements : List.<DiseaseSupplement>of()) {
            Map<String, String> map = new LinkedHashMap<>();
            map.put("seq", supplement.getSeq() != null ? String.valueOf(supplement.getSeq()) : "");
            map.put("supplementCode", supplement.getSupplementCode());
            map.put("supplementName", supplement.getSupplementName());
            maps.add(map);
        }
        return maps;
    }

    private static List<DiseaseSupplement> toDiseaseSupplements(List<Map<String, String>> maps) {
        List<DiseaseSupplement> supplements = new ArrayList<>();
        for (Map<String, String> map : maps != null ? maps : List.<Map<String, String>>of()) {
            DiseaseSupplement supplement = new DiseaseSupplement();
            supplement.setSeq(parseInteger(map.get("seq")));
            supplement.setSupplementCode(map.get("supplementCode"));
            supplement.setSupplementName(map.get("supplementName"));
            supplements.add(supplement);
        }
        return supplements;
    }

    private static Integer parseInteger(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String componentTypeForCode(String code) {
        if (code == null || code.isBlank()) {
            return "UNKNOWN";
        }
        String normalized = code.trim();
        if (normalized.startsWith("ZZZ")) {
            return "UNKNOWN";
        }
        if (normalized.matches("\\d{7}")) {
            return "BODY";
        }
        return "UNKNOWN";
    }

    private static String normalizeOutcomeCode(String code) {
        if (isBlank(code)) {
            return "ACTIVE";
        }
        return switch (code.trim()) {
            case "F", "1" -> "CURED";
            case "D", "2" -> "DEATH";
            case "P", "C", "3" -> "DISCONTINUED";
            case "S", "8" -> "TRANSFERRED";
            case "O" -> "DELETED";
            default -> "ACTIVE";
        };
    }

    private static String snapshotHash(
            String departmentCode,
            String insuranceCombinationNumber,
            String startDate,
            String endDate,
            String outcomeCode,
            List<DiseaseComponent> components,
            List<DiseaseSupplement> supplements) {
        StringBuilder source = new StringBuilder();
        source.append(nullToEmpty(departmentCode)).append('|')
                .append(nullToEmpty(insuranceCombinationNumber)).append('|')
                .append(nullToEmpty(startDate)).append('|')
                .append(nullToEmpty(endDate)).append('|')
                .append(nullToEmpty(outcomeCode));
        for (DiseaseComponent component : components != null ? components : List.<DiseaseComponent>of()) {
            source.append("|c:")
                    .append(component.getSeq()).append(':')
                    .append(nullToEmpty(component.getComponentType())).append(':')
                    .append(nullToEmpty(component.getCode())).append(':')
                    .append(nullToEmpty(component.getName()));
        }
        for (DiseaseSupplement supplement : supplements != null ? supplements : List.<DiseaseSupplement>of()) {
            source.append("|s:")
                    .append(supplement.getSeq()).append(':')
                    .append(nullToEmpty(supplement.getSupplementCode())).append(':')
                    .append(nullToEmpty(supplement.getSupplementName()));
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(source.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : bytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            return Integer.toHexString(source.toString().hashCode());
        }
    }

    private static Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml != null ? xml : "")));
    }

    private static String firstText(Document document, String tag) {
        NodeList nodes = document.getElementsByTagName(tag);
        if (nodes.getLength() == 0) {
            return null;
        }
        String value = nodes.item(0).getTextContent();
        return isBlank(value) ? null : value.trim();
    }

    private static String firstChildText(Element parent, String... tags) {
        for (String tag : tags) {
            NodeList nodes = parent.getElementsByTagName(tag);
            if (nodes.getLength() == 0) {
                continue;
            }
            String value = nodes.item(0).getTextContent();
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private static String normalizeOrcaDate(String value) {
        if (isBlank(value)) {
            return null;
        }
        String digits = value.trim().replace("-", "");
        if (!digits.matches("\\d{8}")) {
            return value.trim();
        }
        return digits.substring(0, 4) + "-" + digits.substring(4, 6) + "-" + digits.substring(6, 8);
    }

    private static String normalizedDiseaseKey(String name, String code) {
        String normalizedName = name != null ? name.replace("　", "").replace(" ", "").trim() : "";
        String normalizedCode = code != null ? code.trim() : "";
        return normalizedName + "\u0000" + normalizedCode;
    }

    private static String safeXml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
