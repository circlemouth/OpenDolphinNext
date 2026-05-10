package open.dolphin.rest.orca;

import java.io.StringReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import open.dolphin.orca.model.OrcaApiResult;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckRequest;
import open.dolphin.rest.dto.orca.ChartSupportContraindicationCheckResponse;
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Request;
import open.dolphin.rest.dto.orca.ChartSupportDiseaseModV3Response;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoRequest;
import open.dolphin.rest.dto.orca.ChartSupportIncomeInfoResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetRequest;
import open.dolphin.rest.dto.orca.ChartSupportMedicationGetResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModResponse;
import open.dolphin.rest.dto.orca.ChartSupportMedicalModV2Request;
import open.dolphin.rest.dto.orca.ChartSupportSubjectivesModV2Request;
import open.dolphin.rest.dto.orca.ChartSupportSubjectivesModV2Response;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

final class OrcaChartSupportSupport {

    private static final java.util.regex.Pattern SENSITIVE_MESSAGE_PATTERN =
            java.util.regex.Pattern.compile("患者|保険|番号|氏名|住所|電話|記号|cookie|authorization|password|passwd|token|session|csrf|jsessionid",
                    java.util.regex.Pattern.CASE_INSENSITIVE);

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
        if (!isBlank(payload.getInsuranceCombinationNumber())) {
            builder.append("<HealthInsurance_Information type=\"record\">");
            appendTag(builder, "Insurance_Combination_Number", payload.getInsuranceCombinationNumber());
            builder.append("</HealthInsurance_Information>");
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
                if (medication == null || isBlank(medication.getCode())
                        || shouldSkipMedicalModV2Medication(medication.getCode())) {
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

    private boolean shouldSkipMedicalModV2Medication(String code) {
        String normalized = safe(code).trim();
        return OrcaOrderBundleRequestSupport.isSendableUsageCode(normalized)
                && !OrcaOrderBundleRequestSupport.isNineDigitCode(normalized)
                && !OrcaOrderBundleRequestSupport.isBodyPartCode(normalized)
                && !OrcaCommentCarrierRules.isOrderBundleCommentCode(normalized);
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
            applyMedicalModOperationStatus(response, transportOk, apiOk);
            if ((!transportOk || !apiOk) && !isBlank(response.getApiResultMessage())) {
                response.setError(response.getApiResultMessage());
            }
        } catch (Exception ex) {
            response.setOk(false);
            response.setApiOk(false);
            response.setNeedsUserReview(true);
            response.setOperationStatus("UNKNOWN");
            response.setError("parser_error");
        }
        return response;
    }

    private void applyMedicalModOperationStatus(ChartSupportMedicalModResponse response, boolean transportOk, boolean apiOk) {
        boolean hasWarnings = response.getMedicalWarnings() != null && !response.getMedicalWarnings().isEmpty();
        boolean completionEvidencePresent = !isBlank(response.getMedicalUid())
                || !isBlank(response.getInvoiceNumber())
                || !isBlank(response.getDataId())
                || (!isBlank(response.getInformationDate()) && !isBlank(response.getInformationTime()));
        OrcaApiResult.OperationStatus status = OrcaApiResult.classifyMutation(
                transportOk,
                response.getApiResult(),
                hasWarnings,
                false,
                apiOk && completionEvidencePresent);
        response.setOperationStatus(status.name());
        response.setNeedsUserReview(OrcaApiResult.needsUserReview(status));
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
            response.setReskey(readFirst(document, "Reskey"));
            response.setBaseDate(readFirst(document, "Base_Date"));

            Element medicationElement = firstElement(document.getDocumentElement(), "Medication_Information");
            ChartSupportMedicationGetResponse.Medication medication = new ChartSupportMedicationGetResponse.Medication();
            medication.setMedicationCode(readFirst(document, "Medication_Code"));
            medication.setMedicationName(readFirst(document, "Medication_Name"));
            medication.setMedicationNameKana(readFirst(document, "Medication_Name_inKana"));
            medication.setUnitCode(readFirst(document, "Unit_Code"));
            medication.setUnitName(readFirst(document, "Unit_Name"));
            medication.setStartDate(readFirst(document, "StartDate"));
            medication.setEndDate(readFirst(document, "EndDate"));
            medication.setRequestCode(readFirst(document, "Request_Code"));
            Map<String, String> medicationExtraFields = collectDirectChildText(
                    medicationElement,
                    "Medication_Code",
                    "Medication_Name",
                    "Medication_Name_inKana",
                    "Unit_Code",
                    "Unit_Name",
                    "StartDate",
                    "EndDate");
            if (!medicationExtraFields.isEmpty()) {
                medication.setExtraFields(medicationExtraFields);
            }
            if (!isBlank(medication.getMedicationCode()) || !isBlank(medication.getMedicationName())
                    || !isBlank(medication.getMedicationNameKana())
                    || !isBlank(medication.getUnitCode())
                    || !isBlank(medication.getUnitName())
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
                selection.setConditionCategory(readFirst(element, "Condition_Category"));
                selection.setNotUseComment(readFirst(element, "Not_Use_Comment"));
                selection.setProcessCategory(readFirst(element, "Process_Category"));
                selection.setSelectionGrepName(readFirst(element, "Selection_Grep_Name"));
                selection.setItemNumber(readFirst(element, "Item_Number"));
                selection.setItemNumberBranch(readFirst(element, "Item_Number_Branch"));
                Map<String, String> selectionExtraFields = collectDirectChildText(
                        element,
                        "Comment_Code",
                        "Comment_Name",
                        "Category",
                        "Condition_Category",
                        "Not_Use_Comment",
                        "Process_Category",
                        "Selection_Grep_Name",
                        "Item_Number",
                        "Item_Number_Branch");
                if (!selectionExtraFields.isEmpty()) {
                    selection.setExtraFields(selectionExtraFields);
                }
                if (!isBlank(selection.getCommentCode()) || !isBlank(selection.getCommentName())
                        || !isBlank(selection.getCategory())
                        || !isBlank(selection.getConditionCategory())
                        || !isBlank(selection.getNotUseComment())
                        || !isBlank(selection.getProcessCategory())
                        || !isBlank(selection.getSelectionGrepName())
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
                entry.setIssuedDate(readFirst(element, "Issued_Date"));
                entry.setInOut(readFirst(element, "InOut"));
                entry.setInvoiceNumber(readFirst(element, "Invoice_Number"));
                entry.setGroupInvoiceNumber(readFirst(element, "Group_Invoice_Number"));
                entry.setDepartmentCode(readFirst(element, "Department_Code"));
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
            response.setUnpaidMoneyTotal(parseDouble(readFirst(document, "Unpaid_Money_Total")));
            String unpaidMoneyOverflow = readFirst(document, "Unpaid_Money_Information_Overflow");
            if (isBooleanLiteral(unpaidMoneyOverflow)) {
                response.setUnpaidMoneyInformationOverflow(parseBoolean(unpaidMoneyOverflow));
            }
            List<ChartSupportIncomeInfoResponse.UnpaidMoneyEntry> unpaidEntries = new ArrayList<>();
            for (Element element : elements(document, "Unpaid_Money_Information_child")) {
                ChartSupportIncomeInfoResponse.UnpaidMoneyEntry entry =
                        new ChartSupportIncomeInfoResponse.UnpaidMoneyEntry();
                entry.setPerformDate(readFirst(element, "Perform_Date"));
                entry.setInOut(readFirst(element, "InOut"));
                entry.setInvoiceNumber(readFirst(element, "Invoice_Number"));
                entry.setUnpaidMoney(parseDouble(readFirst(element, "Unpaid_Money")));
                if (!isBlank(entry.getPerformDate()) || !isBlank(entry.getInvoiceNumber())
                        || !isBlank(entry.getInOut()) || entry.getUnpaidMoney() != null) {
                    unpaidEntries.add(entry);
                }
            }
            response.setUnpaidMoneyInformation(unpaidEntries);
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
        builder.append("<incomeinfv2req type=\"record\">");
        builder.append("<private_objects type=\"record\">");
        appendTag(builder, "Patient_ID", payload.getPatientId());
        appendTag(builder, "Base_Date", payload.getBaseDate());
        builder.append("</private_objects>");
        builder.append("</incomeinfv2req>");
        builder.append("</data>");
        return builder.toString();
    }

    String buildSubjectivesModV2RequestXml(ChartSupportSubjectivesModV2Request payload) {
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<subjectivesmodreq type=\"record\">");
        appendTag(builder, "InOut", fallback(payload.getInOut(), "O"));
        appendTag(builder, "Patient_ID", payload.getPatientId());
        appendTag(builder, "Perform_Date", payload.getPerformDate());
        appendTag(builder, "Department_Code", payload.getDepartmentCode());
        appendTag(builder, "Insurance_Combination_Number", payload.getInsuranceCombinationNumber());
        builder.append("<HealthInsurance_Information type=\"record\">");
        builder.append("</HealthInsurance_Information>");
        appendTag(builder, "Subjectives_Detail_Record", payload.getSubjectivesDetailRecord());
        appendTag(builder, "Subjectives_Code", payload.getSubjectivesCode());
        builder.append("</subjectivesmodreq>");
        builder.append("</data>");
        return builder.toString();
    }

    ChartSupportSubjectivesModV2Response parseSubjectivesModV2Response(
            OrcaTransportResult result,
            String runId,
            String traceId) {
        ChartSupportSubjectivesModV2Response response = new ChartSupportSubjectivesModV2Response();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setStatus(result != null ? result.getStatus() : 500);
        try {
            Document document = parseXml(result != null ? result.getBody() : null);
            response.setApiResult(readFirst(document, "Api_Result"));
            String apiResultMessage = readFirst(document, "Api_Result_Message");
            response.setApiResultMessageCategory(classifySafeMessage(apiResultMessage));
            response.setInformationDate(readFirst(document, "Information_Date"));
            response.setInformationTime(readFirst(document, "Information_Time"));
            boolean transportOk = response.getStatus() >= 200 && response.getStatus() < 300;
            boolean apiOk = response.getApiResult() != null && response.getApiResult().matches("0+");
            boolean completionEvidencePresent = !isBlank(response.getInformationDate())
                    && !isBlank(response.getInformationTime());
            response.setApiOk(apiOk);
            response.setBusinessAccepted(transportOk && apiOk && completionEvidencePresent);
            response.setOk(response.isBusinessAccepted());
            response.setResponseClassification(classifyOfficialMutationResult(
                    transportOk,
                    document,
                    "subjectivesmodres",
                    apiOk,
                    completionEvidencePresent));
            if (!response.isOk() && !isBlank(apiResultMessage)) {
                response.setError(response.getApiResultMessageCategory());
            }
        } catch (Exception ex) {
            response.setOk(false);
            response.setApiOk(false);
            response.setBusinessAccepted(false);
            if (response.getStatus() < 200 || response.getStatus() >= 300) {
                response.setResponseClassification("transportRejected");
                response.setError("transport_error");
            } else {
                response.setResponseClassification("parserAmbiguous");
                response.setError("parser_error");
            }
        }
        return response;
    }

    String buildDiseaseModV3RequestXml(ChartSupportDiseaseModV3Request payload) {
        String operation = normalizeDiseaseOperation(payload.getOperation());
        StringBuilder builder = new StringBuilder();
        builder.append("<data>");
        builder.append("<diseasereq type=\"record\">");
        if ("organizeDeletedDiseases".equals(operation)) {
            appendTag(builder, "Request_Number", "01");
        }
        appendTag(builder, "Patient_ID", payload.getPatientId());
        appendTag(builder, "Base_Month", payload.getBaseMonth());
        appendTag(builder, "Perform_Date", payload.getPerformDate());
        appendTag(builder, "Perform_Time", fallback(payload.getPerformTime(), "00:00:00"));
        ChartSupportDiseaseModV3Request.OrganizeInformation organizeInformation = payload.getOrganizeInformation();
        if (organizeInformation != null) {
            builder.append("<Organize_Information type=\"record\">");
            appendTag(builder, "Department_Code", fallback(organizeInformation.getDepartmentCode(), "01"));
            appendTag(builder, "Disease_StartDate", organizeInformation.getDiseaseStartDate());
            builder.append("</Organize_Information>");
        }
        builder.append("<Diagnosis_Information type=\"record\">");
        appendTag(builder, "Department_Code", payload.getDepartmentCode());
        builder.append("</Diagnosis_Information>");
        if (!"organizeDeletedDiseases".equals(operation)) {
            builder.append("<Disease_Information type=\"array\">");
        }
        if (!"organizeDeletedDiseases".equals(operation) && payload.getDiseaseInformation() != null) {
            for (ChartSupportDiseaseModV3Request.DiseaseInformation entry : payload.getDiseaseInformation()) {
                if (entry == null) {
                    continue;
                }
                builder.append("<Disease_Information_child type=\"record\">");
                appendTag(builder, "Disease_Insurance_Class", entry.getDiseaseInsuranceClass());
                appendTag(builder, "Disease_InOut", fallback(entry.getDiseaseInOut(), "O"));
                if (entry.getComponents() == null || entry.getComponents().isEmpty()) {
                    appendTag(builder, "Disease_Code", entry.getDiseaseCode());
                }
                appendTag(builder, "Disease_Name", firstNonBlank(entry.getDiseaseName(), entry.getDisplayName()));
                appendDiseaseSingle(builder, entry);
                appendTag(builder, "Disease_StartDate", entry.getDiseaseStartDate());
                appendTag(builder, "Disease_EndDate", entry.getDiseaseEndDate());
                appendTag(builder, "Disease_Category", entry.getDiseaseCategory());
                appendTag(builder, "Disease_SuspectedFlag", entry.getDiseaseSuspectedFlag());
                appendTag(builder, "Disease_OutCome",
                        "delete".equals(operation) ? "O" : firstNonBlank(entry.getOrcaOutcomeSendCode(), entry.getDiseaseOutCome()));
                appendTag(builder, "Disease_Karte_Name", entry.getKarteName());
                appendTag(builder, "Disease_Class", entry.getDiseaseClass());
                appendDiseaseSupplements(builder, entry);
                appendTag(builder, "Insurance_Combination_Number", entry.getInsuranceCombinationNumber());
                appendTag(builder, "Disease_Receipt_Print", entry.getDiseaseReceiptPrint());
                appendTag(builder, "Disease_Receipt_Print_Period", entry.getDiseaseReceiptPrintPeriod());
                appendTag(builder, "Insurance_Disease", entry.getInsuranceDisease());
                appendTag(builder, "Discharge_Certificate", entry.getDischargeCertificate());
                appendTag(builder, "Main_Disease_Class", entry.getMainDiseaseClass());
                appendTag(builder, "Sub_Disease_Class", entry.getSubDiseaseClass());
                builder.append("</Disease_Information_child>");
            }
        }
        if (!"organizeDeletedDiseases".equals(operation)) {
            builder.append("</Disease_Information>");
        }
        builder.append("</diseasereq>");
        builder.append("</data>");
        return builder.toString();
    }

    private String normalizeDiseaseOperation(String operation) {
        if (operation == null || operation.isBlank()) {
            return "create";
        }
        return operation.trim();
    }

    ChartSupportDiseaseModV3Response parseDiseaseModV3Response(
            OrcaTransportResult result,
            String runId,
            String traceId) {
        ChartSupportDiseaseModV3Response response = new ChartSupportDiseaseModV3Response();
        response.setRunId(runId);
        response.setTraceId(traceId);
        response.setStatus(result != null ? result.getStatus() : 500);
        try {
            Document document = parseXml(result != null ? result.getBody() : null);
            response.setApiResult(readFirst(document, "Api_Result"));
            String apiResultMessage = readFirst(document, "Api_Result_Message");
            response.setApiResultMessageCategory(classifySafeMessage(apiResultMessage));
            response.setInformationDate(readFirst(document, "Information_Date"));
            response.setInformationTime(readFirst(document, "Information_Time"));
            response.setWarnings(parseDiseaseWarnings(document));
            response.setUnmatchInformation(parseDiseaseUnmatchInformation(document));
            response.setUnmatchInformationOverflow(readFirst(document, "Disease_Unmatch_Information_Overflow"));
            response.setOrganizeInformation(parseDiseaseOrganizeInformation(document));
            boolean transportOk = response.getStatus() >= 200 && response.getStatus() < 300;
            boolean apiOk = response.getApiResult() != null && response.getApiResult().matches("0+");
            boolean completionEvidencePresent = !isBlank(response.getInformationDate())
                    && !isBlank(response.getInformationTime());
            response.setApiOk(apiOk);
            response.setBusinessAccepted(transportOk && apiOk && completionEvidencePresent);
            response.setOk(response.isBusinessAccepted());
            response.setResponseClassification(classifyOfficialMutationResult(
                    transportOk,
                    document,
                    "diseaseres",
                    apiOk,
                    completionEvidencePresent));
            applyDiseaseOperationReviewStatus(response);
            if (!response.isOk() && !isBlank(apiResultMessage)) {
                response.setError(response.getApiResultMessageCategory());
            }
        } catch (Exception ex) {
            response.setOk(false);
            response.setApiOk(false);
            response.setBusinessAccepted(false);
            response.setResponseClassification("parserAmbiguous");
            response.setError("parser_error");
            applyDiseaseOperationReviewStatus(response);
        }
        return response;
    }

    private void applyDiseaseOperationReviewStatus(ChartSupportDiseaseModV3Response response) {
        boolean hasWarnings = response.getWarnings() != null && !response.getWarnings().isEmpty();
        boolean hasUnmatches = response.getUnmatchInformation() != null && !response.getUnmatchInformation().isEmpty();
        String classification = response.getResponseClassification();
        boolean transportOk = !"transportRejected".equals(classification);
        boolean completionEvidencePresent = "businessAccepted".equals(classification);
        OrcaApiResult.OperationStatus status = OrcaApiResult.classifyMutation(
                transportOk,
                response.getApiResult(),
                hasWarnings,
                hasUnmatches,
                completionEvidencePresent);
        response.setOperationStatus(status.name());
        response.setNeedsUserReview(OrcaApiResult.needsUserReview(status));
    }

    private void appendDiseaseSingle(StringBuilder builder, ChartSupportDiseaseModV3Request.DiseaseInformation entry) {
        if (entry.getComponents() == null || entry.getComponents().isEmpty()) {
            return;
        }
        builder.append("<Disease_Single type=\"array\">");
        entry.getComponents().stream()
                .filter(component -> component != null && !isBlank(component.getCode()))
                .sorted(java.util.Comparator.comparing(
                        ChartSupportDiseaseModV3Request.DiseaseComponent::getSeq,
                        java.util.Comparator.nullsLast(Integer::compareTo)))
                .limit(21)
                .forEach(component -> {
                    builder.append("<Disease_Single_child type=\"record\">");
                    appendTag(builder, "Disease_Single_Code", component.getCode());
                    appendTag(builder, "Disease_Single_Name", component.getName());
                    builder.append("</Disease_Single_child>");
                });
        builder.append("</Disease_Single>");
    }

    private void appendDiseaseSupplements(StringBuilder builder, ChartSupportDiseaseModV3Request.DiseaseInformation entry) {
        if (entry.getSupplements() == null || entry.getSupplements().isEmpty()) {
            return;
        }
        builder.append("<Disease_Supplement_Single type=\"array\">");
        entry.getSupplements().stream()
                .filter(supplement -> supplement != null
                        && (!isBlank(supplement.getSupplementCode()) || !isBlank(supplement.getSupplementName())))
                .sorted(java.util.Comparator.comparing(
                        ChartSupportDiseaseModV3Request.DiseaseSupplement::getSeq,
                        java.util.Comparator.nullsLast(Integer::compareTo)))
                .forEach(supplement -> {
                    builder.append("<Disease_Supplement_Single_child type=\"record\">");
                    appendTag(builder, "Disease_Supplement_Single_Code", supplement.getSupplementCode());
                    appendTag(builder, "Disease_Supplement_Single_Name", supplement.getSupplementName());
                    builder.append("</Disease_Supplement_Single_child>");
                });
        builder.append("</Disease_Supplement_Single>");
    }

    private List<ChartSupportDiseaseModV3Response.DiseaseWarning> parseDiseaseWarnings(Document document) {
        List<ChartSupportDiseaseModV3Response.DiseaseWarning> warnings = new ArrayList<>();
        for (Element element : elements(document, "Disease_Warning_Info_child")) {
            ChartSupportDiseaseModV3Response.DiseaseWarning warning =
                    new ChartSupportDiseaseModV3Response.DiseaseWarning();
            warning.setCode(firstNonBlank(readFirst(element, "Disease_Warning_Code"), readFirst(element, "Warning_Code")));
            warning.setPosition(parseInteger(firstNonBlank(
                    readFirst(element, "Disease_Warning_Position"),
                    readFirst(element, "Warning_Position"))));
            warning.setMessageCategory(classifySafeMessage(firstNonBlank(
                    readFirst(element, "Disease_Warning_Message"),
                    readFirst(element, "Warning_Message"))));
            warnings.add(warning);
        }
        return warnings;
    }

    private List<ChartSupportDiseaseModV3Response.DiseaseUnmatchInformation> parseDiseaseUnmatchInformation(Document document) {
        List<ChartSupportDiseaseModV3Response.DiseaseUnmatchInformation> unmatches = new ArrayList<>();
        List<Element> elements = new ArrayList<>(elements(document, "Disease_Unmatch_Information_child"));
        elements.addAll(elements(document, "Disease_Unmatch_Info_child"));
        for (Element element : elements) {
            ChartSupportDiseaseModV3Response.DiseaseUnmatchInformation unmatch =
                    new ChartSupportDiseaseModV3Response.DiseaseUnmatchInformation();
            unmatch.setCode(firstNonBlank(readFirst(element, "Disease_Unmatch_Code"), readFirst(element, "Disease_Code")));
            unmatch.setName(firstNonBlank(readFirst(element, "Disease_Unmatch_Name"), readFirst(element, "Disease_Name")));
            unmatch.setSupplementName(readFirst(element, "Disease_Supplement_Name"));
            unmatch.setInOut(readFirst(element, "Disease_InOut"));
            unmatch.setCategory(readFirst(element, "Disease_Category"));
            unmatch.setSuspectedFlag(readFirst(element, "Disease_SuspectedFlag"));
            unmatch.setStartDate(readFirst(element, "Disease_StartDate"));
            unmatch.setEndDate(readFirst(element, "Disease_EndDate"));
            unmatch.setOutcome(readFirst(element, "Disease_OutCome"));
            unmatch.setMessageCategory(classifySafeMessage(firstNonBlank(
                    readFirst(element, "Disease_Unmatch_Message"),
                    readFirst(element, "Message"))));
            unmatches.add(unmatch);
        }
        return unmatches;
    }

    private ChartSupportDiseaseModV3Response.OrganizeInformation parseDiseaseOrganizeInformation(Document document) {
        Element element = elements(document, "Organize_Information").stream().findFirst().orElse(null);
        if (element == null) {
            return null;
        }
        ChartSupportDiseaseModV3Response.OrganizeInformation information =
                new ChartSupportDiseaseModV3Response.OrganizeInformation();
        information.setDepartmentCode(readFirst(element, "Department_Code"));
        information.setDiseaseStartDate(readFirst(element, "Disease_StartDate"));
        if (isBlank(information.getDepartmentCode()) && isBlank(information.getDiseaseStartDate())) {
            return null;
        }
        return information;
    }

    private String classifyOfficialMutationResult(
            boolean transportOk,
            Document document,
            String expectedRoot,
            boolean apiOk,
            boolean completionEvidencePresent) {
        if (!transportOk) {
            return "transportRejected";
        }
        if (document == null || elements(document, expectedRoot).isEmpty()) {
            return "parserAmbiguous";
        }
        if (!apiOk) {
            return "businessRejected";
        }
        if (!completionEvidencePresent) {
            return "notVerified";
        }
        return "businessAccepted";
    }

    private String classifySafeMessage(String value) {
        if (isBlank(value)) {
            return "none";
        }
        String normalized = value.trim();
        if (SENSITIVE_MESSAGE_PATTERN.matcher(normalized).find()) {
            return "present_redacted_sensitive_shape";
        }
        String lower = normalized.toLowerCase(java.util.Locale.ROOT);
        if (lower.contains("ok") || normalized.contains("正常") || normalized.contains("完了")) {
            return "ok_like";
        }
        if (lower.contains("warning") || normalized.contains("警告")) {
            return "warning_like";
        }
        if (lower.contains("error") || lower.contains("reject") || normalized.contains("エラー")
                || normalized.contains("失敗") || normalized.contains("不可")) {
            return "error_like";
        }
        return "present_redacted";
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

    private boolean parseBoolean(String value) {
        return "true".equals(value.trim().toLowerCase());
    }

    private boolean isBooleanLiteral(String value) {
        if (isBlank(value)) {
            return false;
        }
        String normalized = value.trim().toLowerCase();
        return "true".equals(normalized) || "false".equals(normalized);
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

    private Map<String, String> collectDirectChildText(Element parent, String... excludedTagNames) {
        if (parent == null) {
            return Map.of();
        }
        java.util.Set<String> excluded = java.util.Set.of(excludedTagNames);
        Map<String, String> values = new LinkedHashMap<>();
        Node child = parent.getFirstChild();
        while (child != null) {
            if (child instanceof Element element && !excluded.contains(element.getTagName())) {
                String text = element.getTextContent();
                if (text != null && !text.isBlank()) {
                    values.put(element.getTagName(), text.trim());
                }
            }
            child = child.getNextSibling();
        }
        return values;
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
