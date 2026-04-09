package open.dolphin.rest.orca;

import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckRequest;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckResponse;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoRequest;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetRequest;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV23Request;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

final class OrcaChartSupportSupport {

    String buildMedicalModV2RequestXml(ChartSupportMedicalModV2Request payload) {
        validateMedicalModV2Request(payload);
        String performDate = payload.getPerformDate();
        String datePart = performDate != null && performDate.length() >= 10 ? performDate.substring(0, 10) : safe(payload.getPerformDate());
        String timePart = performDate != null && performDate.length() >= 19 ? performDate.substring(11, 19) : "00:00:00";
        List<ChartSupportMedicalModV2Request.MedicalInformation> information = new ArrayList<>();
        if (payload.isIncludeInitialConsultation()) {
            ChartSupportMedicalModV2Request.MedicalInformation initial = new ChartSupportMedicalModV2Request.MedicalInformation();
            initial.setMedicalClass("110");
            initial.setMedicalClassName(OrcaMedicalClassCatalog.resolveExactClassName(null, "110"));
            initial.setMedicalClassNumber("1");
            ChartSupportMedicalModV2Request.Medication medication = new ChartSupportMedicalModV2Request.Medication();
            medication.setCode("110000010");
            medication.setName("初診料");
            medication.setNumber("1");
            initial.setMedications(List.of(medication));
            information.add(initial);
        }
        if (payload.getMedicalInformation() != null) {
            information.addAll(payload.getMedicalInformation());
        }

        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<medicalreq type=\"record\">");
        appendTag(builder, "Request_Number", fallback(payload.getRequestNumber(), "01"));
        appendTag(builder, "InOut", "O");
        appendTag(builder, "Patient_ID", payload.getPatientId());
        appendTag(builder, "Perform_Date", datePart);
        appendTag(builder, "Perform_Time", timePart);
        if (!isBlank(payload.getMedicalPush())) {
            appendTag(builder, "Medical_Push", payload.getMedicalPush());
        }
        if (!isBlank(payload.getMedicalUid())) {
            appendTag(builder, "Medical_Uid", payload.getMedicalUid());
        }
        builder.append("<Diagnosis_Information type=\"record\">");
        appendTag(builder, "Department_Code", payload.getDepartmentCode());
        if (!isBlank(payload.getPhysicianCode())) {
            appendTag(builder, "Physician_Code", payload.getPhysicianCode());
        }
        builder.append("<Medical_Information type=\"array\">");
        for (ChartSupportMedicalModV2Request.MedicalInformation entry : information) {
            if (entry == null || isBlank(entry.getMedicalClass()) || entry.getMedications() == null
                    || entry.getMedications().isEmpty()) {
                continue;
            }
            builder.append("<Medical_Information_child type=\"record\">");
            appendTag(builder, "Medical_Class", entry.getMedicalClass());
            String medicalClassName = OrcaMedicalClassCatalog.resolveExactClassName(null, entry.getMedicalClass());
            if (isBlank(medicalClassName)) {
                medicalClassName = safe(entry.getMedicalClassName());
            }
            if (!isBlank(medicalClassName)) {
                appendTag(builder, "Medical_Class_Name", medicalClassName);
            }
            appendTag(builder, "Medical_Class_Number", fallback(entry.getMedicalClassNumber(), "1"));
            builder.append("<Medication_info type=\"array\">");
            for (ChartSupportMedicalModV2Request.Medication medication : entry.getMedications()) {
                if (medication == null || isBlank(medication.getCode())) {
                    continue;
                }
                builder.append("<Medication_info_child type=\"record\">");
                appendTag(builder, "Medication_Code", medication.getCode());
                if (!isBlank(medication.getName())) {
                    appendTag(builder, "Medication_Name", medication.getName());
                }
                appendTag(builder, "Medication_Number", fallback(medication.getNumber(), ""));
                if (!isBlank(medication.getGenericFlg())) {
                    appendTag(builder, "Medication_Generic_Flg", medication.getGenericFlg());
                }
                builder.append("</Medication_info_child>");
            }
            builder.append("</Medication_info>");
            builder.append("</Medical_Information_child>");
        }
        builder.append("</Medical_Information>");
        builder.append("</Diagnosis_Information>");
        builder.append("</medicalreq>");
        builder.append("</data>");
        return builder.toString();
    }

    void validateMedicalModV2Request(ChartSupportMedicalModV2Request payload) {
        if (payload == null) {
            throw new IllegalArgumentException("payload is required");
        }
        if (payload.getMedicalInformation() == null) {
            return;
        }
        payload.validateForOrcaSend();
    }

    String buildMedicalModV23RequestXml(ChartSupportMedicalModV23Request payload) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<medicalv2req3 type=\"record\">");
        appendTag(builder, "Request_Number", fallback(payload.getRequestNumber(), ""));
        appendTag(builder, "Patient_ID", payload.getPatientId());
        appendTag(builder, "First_Calculation_Date", fallback(payload.getFirstCalculationDate(), ""));
        appendTag(builder, "LastVisit_Date", fallback(payload.getLastVisitDate(), ""));
        appendTag(builder, "Department_Code", fallback(payload.getDepartmentCode(), ""));
        builder.append("</medicalv2req3>");
        builder.append("</data>");
        return builder.toString();
    }

    ChartSupportMedicalModResponse parseMedicalModResponse(
            OrcaTransportResult result,
            String runId,
            String traceId) {
        ChartSupportMedicalModResponse response = new ChartSupportMedicalModResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setStatus(result != null ? result.getStatus() : 500);
        try {
            Document document = parseXml(result != null ? result.getBody() : null);
            response.setApiResult(readFirst(document, "Api_Result"));
            response.setApiResultMessage(readFirst(document, "Api_Result_Message"));
            response.setInformationDate(readFirst(document, "Information_Date"));
            response.setInformationTime(readFirst(document, "Information_Time"));
            response.setMedicalUid(readFirst(document, "Medical_Uid"));
            response.setInvoiceNumber(readFirst(document, "Invoice_Number"));
            response.setDataId(firstNonBlank(readFirst(document, "Data_Id"), readFirst(document, "DataID"), readFirst(document, "Data_ID")));
            List<Element> warningNodes = elements(document, "Medical_Warning_Info_child");
            List<ChartSupportMedicalModResponse.MedicalWarning> warnings = new ArrayList<>();
            for (Element element : warningNodes) {
                ChartSupportMedicalModResponse.MedicalWarning warning = new ChartSupportMedicalModResponse.MedicalWarning();
                warning.setMedicalWarning(readFirst(element, "Medical_Warning"));
                warning.setMedicalWarningMessage(readFirst(element, "Medical_Warning_Message"));
                warning.setMedicalWarningPosition(parseInteger(readFirst(element, "Medical_Warning_Position")));
                warning.setMedicalWarningItemPosition(parseInteger(readFirst(element, "Medical_Warning_Item_Position")));
                warning.setMedicalWarningCode(readFirst(element, "Medical_Warning_Code"));
                warnings.add(warning);
            }
            response.setMedicalWarnings(warnings);
            boolean transportOk = result != null && result.getStatus() >= 200 && result.getStatus() < 300;
            boolean apiOk = response.getApiResult() != null && response.getApiResult().matches("0+");
            response.setApiOk(apiOk);
            response.setOk(transportOk && apiOk);
            if ((!transportOk || !apiOk) && !isBlank(response.getApiResultMessage())) {
                response.setError(response.getApiResultMessage());
            }
        } catch (Exception ex) {
            response.setOk(false);
            response.setApiOk(false);
            response.setError(ex.getMessage());
        }
        return response;
    }

    ChartSupportMedicationGetResponse parseMedicationGetResponse(
            OrcaTransportResult result,
            String runId,
            String traceId) {
        ChartSupportMedicationGetResponse response = new ChartSupportMedicationGetResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setStatus(result != null ? result.getStatus() : 500);
        try {
            Document document = parseXml(result != null ? result.getBody() : null);
            response.setApiResult(readFirst(document, "Api_Result"));
            response.setApiResultMessage(readFirst(document, "Api_Result_Message"));
            response.setInformationDate(readFirst(document, "Information_Date"));
            response.setInformationTime(readFirst(document, "Information_Time"));

            ChartSupportMedicationGetResponse.Medication medication = new ChartSupportMedicationGetResponse.Medication();
            medication.setMedicationCode(readFirst(document, "Medication_Code"));
            medication.setMedicationName(readFirst(document, "Medication_Name"));
            medication.setMedicationNameKana(readFirst(document, "Medication_Name_inKana"));
            medication.setStartDate(readFirst(document, "StartDate"));
            medication.setEndDate(readFirst(document, "EndDate"));
            medication.setRequestCode(readFirst(document, "Request_Code"));
            if (!isBlank(medication.getMedicationCode()) || !isBlank(medication.getMedicationName())
                    || !isBlank(medication.getMedicationNameKana())
                    || !isBlank(medication.getRequestCode())
                    || !isBlank(medication.getStartDate())
                    || !isBlank(medication.getEndDate())) {
                response.setMedication(medication);
            }

            List<ChartSupportMedicationGetResponse.Selection> selections = new ArrayList<>();
            for (Element element : elements(document, "Selection_Expression_Information_child")) {
                ChartSupportMedicationGetResponse.Selection selection = new ChartSupportMedicationGetResponse.Selection();
                selection.setCommentCode(readFirst(element, "Comment_Code"));
                selection.setCommentName(readFirst(element, "Comment_Name"));
                selection.setCategory(readFirst(element, "Category"));
                selection.setItemNumber(readFirst(element, "Item_Number"));
                selection.setItemNumberBranch(readFirst(element, "Item_Number_Branch"));
                if (!isBlank(selection.getCommentCode()) || !isBlank(selection.getCommentName())
                        || !isBlank(selection.getCategory())
                        || !isBlank(selection.getItemNumber())
                        || !isBlank(selection.getItemNumberBranch())) {
                    selections.add(selection);
                }
            }
            response.setSelections(selections);
            setResponseResultFlags(response, response.getApiResult(), response.getApiResultMessage());
        } catch (Exception ex) {
            response.setOk(false);
            response.setApiOk(false);
            response.setError(ex.getMessage());
        }
        return response;
    }

    ChartSupportContraindicationCheckResponse parseContraindicationCheckResponse(
            OrcaTransportResult result,
            String runId,
            String traceId) {
        ChartSupportContraindicationCheckResponse response = new ChartSupportContraindicationCheckResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setStatus(result != null ? result.getStatus() : 500);
        try {
            Document document = parseXml(result != null ? result.getBody() : null);
            response.setApiResult(readFirst(document, "Api_Result"));
            response.setApiResultMessage(readFirst(document, "Api_Result_Message"));
            response.setInformationDate(readFirst(document, "Information_Date"));
            response.setInformationTime(readFirst(document, "Information_Time"));

            List<ChartSupportContraindicationCheckResponse.Result> results = new ArrayList<>();
            for (Element element : elements(document, "Medical_Information_child")) {
                ChartSupportContraindicationCheckResponse.Result resultItem =
                        new ChartSupportContraindicationCheckResponse.Result();
                resultItem.setMedicationCode(readFirst(element, "Medication_Code"));
                resultItem.setMedicationName(readFirst(element, "Medication_Name"));
                resultItem.setMedicalResult(readFirst(element, "Medical_Result"));
                resultItem.setMedicalResultMessage(readFirst(element, "Medical_Result_Message"));
                for (Element warning : elements(element, "Medical_Info_child")) {
                    ChartSupportContraindicationCheckResponse.Warning warningDto =
                            new ChartSupportContraindicationCheckResponse.Warning();
                    warningDto.setContraCode(readFirst(warning, "Contra_Code"));
                    warningDto.setContraName(readFirst(warning, "Contra_Name"));
                    warningDto.setInteractCode(readFirst(warning, "Interact_Code"));
                    warningDto.setAdministerDate(readFirst(warning, "Administer_Date"));
                    warningDto.setContextClass(readFirst(warning, "Context_Class"));
                    resultItem.getWarnings().add(warningDto);
                }
                if (!isBlank(resultItem.getMedicationCode()) || !isBlank(resultItem.getMedicationName())
                        || !isBlank(resultItem.getMedicalResult()) || !isBlank(resultItem.getMedicalResultMessage())
                        || !resultItem.getWarnings().isEmpty()) {
                    results.add(resultItem);
                }
            }
            response.setResults(results);

            List<ChartSupportContraindicationCheckResponse.SymptomInfo> symptomInfos = new ArrayList<>();
            for (Element element : elements(document, "Symptom_Information_child")) {
                ChartSupportContraindicationCheckResponse.SymptomInfo info =
                        new ChartSupportContraindicationCheckResponse.SymptomInfo();
                info.setCode(readFirst(element, "Symptom_Code"));
                info.setContent(readFirst(element, "Symptom_Content"));
                info.setDetail(readFirst(element, "Symptom_Detail"));
                if (!isBlank(info.getCode()) || !isBlank(info.getContent()) || !isBlank(info.getDetail())) {
                    symptomInfos.add(info);
                }
            }
            response.setSymptomInfo(symptomInfos);

            setResponseResultFlags(response, response.getApiResult(), response.getApiResultMessage());
        } catch (Exception ex) {
            response.setOk(false);
            response.setApiOk(false);
            response.setError(ex.getMessage());
        }
        return response;
    }

    ChartSupportIncomeInfoResponse parseIncomeInfoResponse(
            OrcaTransportResult result,
            String runId,
            String traceId) {
        ChartSupportIncomeInfoResponse response = new ChartSupportIncomeInfoResponse();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setStatus(result != null ? result.getStatus() : 500);
        try {
            Document document = parseXml(result != null ? result.getBody() : null);
            response.setApiResult(readFirst(document, "Api_Result"));
            response.setApiResultMessage(readFirst(document, "Api_Result_Message"));
            response.setInformationDate(readFirst(document, "Information_Date"));
            response.setInformationTime(readFirst(document, "Information_Time"));

            List<ChartSupportIncomeInfoResponse.Entry> entries = new ArrayList<>();
            for (Element element : elements(document, "Income_Information_child")) {
                ChartSupportIncomeInfoResponse.Entry entry = new ChartSupportIncomeInfoResponse.Entry();
                entry.setPerformDate(readFirst(element, "Perform_Date"));
                entry.setPerformEndDate(readFirst(element, "Perform_End_Date"));
                entry.setInOut(readFirst(element, "InOut"));
                entry.setInvoiceNumber(readFirst(element, "Invoice_Number"));
                entry.setDepartmentName(readFirst(element, "Department_Name"));
                entry.setInsuranceCombinationNumber(readFirst(element, "Insurance_Combination_Number"));
                Element cd = firstElement(element, "Cd_Information");
                if (cd != null) {
                    entry.setAcMoney(parseDouble(readFirst(cd, "Ac_Money")));
                    entry.setIcMoney(parseDouble(readFirst(cd, "Ic_Money")));
                    entry.setAiMoney(parseDouble(readFirst(cd, "Ai_Money")));
                    entry.setOeMoney(parseDouble(readFirst(cd, "Oe_Money")));
                    entry.setMlSmoney(parseDouble(readFirst(cd, "Ml_Smoney")));
                }
                entries.add(entry);
            }
            response.setEntries(entries);
            setResponseResultFlags(response, response.getApiResult(), response.getApiResultMessage());
        } catch (Exception ex) {
            response.setOk(false);
            response.setApiOk(false);
            response.setError(ex.getMessage());
        }
        return response;
    }

    String buildMedicationGetRequestXml(ChartSupportMedicationGetRequest payload) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<medicationgetreq type=\"record\">");
        appendTag(builder, "Request_Number", fallback(payload.getRequestNumber(), "02"));
        appendTag(builder, "Request_Code", payload.getRequestCode());
        appendTag(builder, "Base_Date", payload.getBaseDate());
        builder.append("</medicationgetreq>");
        builder.append("</data>");
        return builder.toString();
    }

    String buildContraindicationCheckRequestXml(ChartSupportContraindicationCheckRequest payload) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<contraindication_checkreq type=\"record\">");
        appendTag(builder, "Request_Number", fallback(payload.getRequestNumber(), "01"));
        appendTag(builder, "Patient_ID", payload.getPatientId());
        appendTag(builder, "Perform_Month", payload.getPerformMonth());
        appendTag(builder, "Check_Term", fallback(payload.getCheckTerm(), "1"));
        builder.append("<Medical_Information type=\"array\">");
        if (payload.getMedications() != null) {
            for (ChartSupportContraindicationCheckRequest.Medication medication : payload.getMedications()) {
                if (medication == null || isBlank(medication.getMedicationCode())) {
                    continue;
                }
                builder.append("<Medical_Information_child type=\"record\">");
                appendTag(builder, "Medication_Code", medication.getMedicationCode());
                appendTag(builder, "Medication_Name", medication.getMedicationName());
                builder.append("</Medical_Information_child>");
            }
        }
        builder.append("</Medical_Information>");
        builder.append("</contraindication_checkreq>");
        builder.append("</data>");
        return builder.toString();
    }

    String buildIncomeInfoRequestXml(ChartSupportIncomeInfoRequest payload) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<incomeinfreq type=\"record\">");
        appendTag(builder, "Request_Number", "01");
        appendTag(builder, "Patient_ID", payload.getPatientId());
        appendTag(builder, "Perform_Month", payload.getPerformMonth());
        appendTag(builder, "Perform_Year", payload.getPerformYear());
        builder.append("</incomeinfreq>");
        builder.append("</data>");
        return builder.toString();
    }

    private void setResponseResultFlags(
            Object response,
            String apiResult,
            String apiResultMessage) {
        if (response instanceof ChartSupportMedicalModResponse target) {
            boolean transportOk = target.getStatus() >= 200 && target.getStatus() < 300;
            boolean apiOk = apiResult != null && apiResult.matches("0+");
            target.setApiOk(apiOk);
            target.setOk(transportOk && apiOk);
            if ((!transportOk || !apiOk) && !isBlank(apiResultMessage)) {
                target.setError(apiResultMessage);
            }
            return;
        }
        if (response instanceof ChartSupportMedicationGetResponse target) {
            boolean transportOk = target.getStatus() >= 200 && target.getStatus() < 300;
            boolean apiOk = apiResult != null && apiResult.matches("0+");
            target.setApiOk(apiOk);
            target.setOk(transportOk && apiOk);
            if ((!transportOk || !apiOk) && !isBlank(apiResultMessage)) {
                target.setError(apiResultMessage);
            }
            return;
        }
        if (response instanceof ChartSupportContraindicationCheckResponse target) {
            boolean transportOk = target.getStatus() >= 200 && target.getStatus() < 300;
            boolean apiOk = apiResult != null && apiResult.matches("0+");
            target.setApiOk(apiOk);
            target.setOk(transportOk && apiOk);
            if ((!transportOk || !apiOk) && !isBlank(apiResultMessage)) {
                target.setError(apiResultMessage);
            }
            return;
        }
        if (response instanceof ChartSupportIncomeInfoResponse target) {
            boolean transportOk = target.getStatus() >= 200 && target.getStatus() < 300;
            boolean apiOk = apiResult != null && apiResult.matches("0+");
            target.setApiOk(apiOk);
            target.setOk(transportOk && apiOk);
            if ((!transportOk || !apiOk) && !isBlank(apiResultMessage)) {
                target.setError(apiResultMessage);
            }
        }
    }

    private Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setNamespaceAware(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new InputSource(new StringReader(fallback(xml, ""))));
    }

    private List<Element> elements(Document document, String tagName) {
        if (document == null) {
            return List.of();
        }
        return elements(document.getDocumentElement(), tagName);
    }

    private List<Element> elements(Element parent, String tagName) {
        if (parent == null) {
            return List.of();
        }
        NodeList nodes = parent.getElementsByTagName(tagName);
        List<Element> results = new ArrayList<>();
        for (int i = 0; i < nodes.getLength(); i++) {
            if (nodes.item(i) instanceof Element element) {
                results.add(element);
            }
        }
        return results;
    }

    private String readFirst(Document document, String tagName) {
        if (document == null) {
            return null;
        }
        return readFirst(document.getDocumentElement(), tagName);
    }

    private String readFirst(Element parent, String tagName) {
        if (parent == null) {
            return null;
        }
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return null;
        }
        String value = nodes.item(0).getTextContent();
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private Integer parseInteger(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return Integer.valueOf(value.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Double parseDouble(String value) {
        if (isBlank(value)) {
            return null;
        }
        try {
            return Double.valueOf(value.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Element firstElement(Element parent, String tagName) {
        if (parent == null) {
            return null;
        }
        NodeList nodes = parent.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) {
            return null;
        }
        return nodes.item(0) instanceof Element element ? element : null;
    }

    private void appendTag(StringBuilder builder, String tagName, String value) {
        builder.append("<").append(tagName).append(" type=\"string\">");
        builder.append(escapeXml(fallback(value, "")));
        builder.append("</").append(tagName).append(">");
    }

    private String escapeXml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private String safe(String value) {
        return value != null ? value : "";
    }

    private String fallback(String value, String defaultValue) {
        return value != null ? value : defaultValue;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
