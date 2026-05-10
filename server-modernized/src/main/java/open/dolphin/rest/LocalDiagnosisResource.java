package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.ModelUtils;
import open.dolphin.infomodel.PatientModel;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.orca.service.OrcaDiseaseCacheStore;
import open.dolphin.orca.service.DiseaseProjectionService;
import open.dolphin.orca.transport.OrcaEndpoint;
import open.dolphin.orca.transport.OrcaTransport;
import open.dolphin.orca.transport.OrcaTransportRequest;
import open.dolphin.orca.transport.OrcaTransportResult;
import open.dolphin.rest.dto.orca.DiseaseImportResponse;
import open.dolphin.rest.masterupdate.MasterUpdateStore;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.PatientServiceBean;

@Path("/local/diagnoses")
public class LocalDiagnosisResource extends AbstractResource {

    private static final DateTimeFormatter BASE_MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyyMM");

    @Inject
    private PatientServiceBean patientServiceBean;

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private OrcaTransport orcaTransport;

    @Inject
    private DiseaseProjectionService diseaseProjectionService;

    @Inject
    private OrcaDiseaseCacheStore diseaseCacheStore;

    @Inject
    private MasterUpdateStore masterUpdateStore;

    @GET
    @Path("/{patientId}")
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> getDiagnoses(
            @Context HttpServletRequest request,
            @PathParam("patientId") String patientId,
            @QueryParam("from") String from,
            @QueryParam("to") String to,
            @QueryParam("activeOnly") @DefaultValue("false") boolean activeOnly,
            @QueryParam("includeEnded") @DefaultValue("false") boolean includeEnded) {
        String facilityId = requireActorFacility(request);
        PatientModel patient = patientServiceBean.getPatientById(facilityId, patientId);
        if (patient == null) {
            throw restError(request, Response.Status.NOT_FOUND, "patient_not_found", "Patient not found");
        }
        Date fromDate = ModelUtils.getDateAsObject(from != null ? from : ModelUtils.getDateAsString(ModelUtils.AD1800));
        Date toDate = ModelUtils.getDateAsObject(to != null ? to : ModelUtils.getDateAsString(new Date()));
        KarteBean karte = karteServiceBean.getKarte(facilityId, patientId, fromDate);
        if (karte == null) {
            throw restError(request, Response.Status.NOT_FOUND, "karte_not_found", "Karte not found");
        }
        List<RegisteredDiagnosisModel> diagnoses = karteServiceBean.getDiagnosis(karte.getId(), fromDate, activeOnly);
        List<Map<String, Object>> pendingLocalItems = new ArrayList<>();
        for (RegisteredDiagnosisModel diagnosis : diagnoses) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("diagnosisId", diagnosis.getId());
            item.put("karteId", karte.getId());
            item.put("patientId", patientId);
            item.put("diagnosisName", diagnosis.getDiagnosis());
            item.put("diagnosisCode", diagnosis.getDiagnosisCode());
            item.put("departmentCode", diagnosis.getDepartment());
            item.put("startDate", diagnosis.getStarted() != null ? ModelUtils.getDateAsString(diagnosis.getStarted()) : null);
            item.put("endDate", diagnosis.getEnded() != null ? ModelUtils.getDateAsString(diagnosis.getEnded()) : null);
            item.put("outcome", diagnosis.getOutcome());
            item.put("category", diagnosis.getCategory());
            item.put("suspectedFlag", diagnosis.getCategoryDesc());
            item.put("layer", "insurance-local");
            item.put("syncState", "none");
            item.put("readOnly", Boolean.FALSE);
            item.put("candidateOnly", Boolean.FALSE);
            pendingLocalItems.add(item);
        }
        DiseaseImportResponse mirrorResponse = fetchOrcaMirror(request, facilityId, patientId, fromDate, toDate, includeEnded);
        String diseaseMasterVersion = resolveDiseaseMasterVersion();
        if (mirrorResponse.getMasterVersion() == null) {
            mirrorResponse.setMasterVersion(diseaseMasterVersion);
        }
        List<DiseaseImportResponse.DiseaseEntry> mirrorEntries =
                mirrorResponse.getDiseases() != null ? mirrorResponse.getDiseases() : List.of();
        projectionService().applyMirrorDiffState(pendingLocalItems, mirrorEntries);
        List<Map<String, Object>> mirrorItems = new ArrayList<>();
        for (DiseaseImportResponse.DiseaseEntry entry : mirrorEntries) {
            if (entry.getMasterVersion() == null) {
                entry.setMasterVersion(diseaseMasterVersion);
            }
            mirrorItems.add(toMirrorItem(entry));
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("patientId", patientId);
        response.put("karteId", karte.getId());
        response.put("runId", resolveTraceId(request));
        response.put("sourceOfTruth", "orca");
        response.put("orcaMirrorStatus", mirrorResponse.getOrcaMirrorStatus());
        response.put("masterVersion", mirrorResponse.getMasterVersion());
        response.put("diseases", mirrorItems);
        response.put("pendingLocalDiseases", pendingLocalItems);
        return response;
    }

    Map<String, Object> getDiagnoses(
            HttpServletRequest request,
            String patientId,
            String from,
            String to,
            boolean activeOnly) {
        return getDiagnoses(request, patientId, from, to, activeOnly, false);
    }

    private DiseaseImportResponse fetchOrcaMirror(
            HttpServletRequest request,
            String facilityId,
            String patientId,
            Date fromDate,
            Date toDate,
            boolean includeEnded) {
        DiseaseImportResponse unavailable = new DiseaseImportResponse();
        unavailable.setRunId(resolveTraceId(request));
        unavailable.setPatientId(patientId);
        unavailable.setOrcaMirrorStatus("unavailable");
        unavailable.setMasterVersion(resolveDiseaseMasterVersion());
        unavailable.setDiseases(List.of());
        if (orcaTransport == null) {
            return unavailable;
        }
        try {
            LocalDate baseDate = toDateOnly(toDate);
            String requestXml = projectionService().buildDiseaseGetRequestXml(patientId, baseDate, includeEnded);
            OrcaTransportResult result = orcaTransport.invoke(
                    facilityId,
                    OrcaEndpoint.DISEASE_GET,
                    OrcaTransportRequest.post(requestXml).withQuery(DiseaseProjectionService.DISEASE_GET_QUERY));
            DiseaseImportResponse response =
                    projectionService().buildMirrorResponseFromOrca(result, resolveTraceId(request), patientId, fromDate, toDate);
            saveOrcaDiseaseCache(request, facilityId, patientId, baseDate, result, response);
            return response;
        } catch (RuntimeException ex) {
            return unavailable;
        }
    }

    private void saveOrcaDiseaseCache(
            HttpServletRequest request,
            String facilityId,
            String patientId,
            LocalDate baseDate,
            OrcaTransportResult result,
            DiseaseImportResponse response) {
        if (diseaseCacheStore == null || result == null || !"connected".equals(response.getOrcaMirrorStatus())) {
            return;
        }
        String traceId = resolveTraceId(request);
        diseaseCacheStore.save(new OrcaDiseaseCacheStore.DiseaseCacheCommand(
                facilityId,
                patientId,
                BASE_MONTH_FORMAT.format(baseDate),
                baseDate,
                firstDepartmentCode(response),
                firstInsuranceCombinationNumber(response),
                traceId,
                traceId,
                null,
                null,
                result.getBody(),
                response));
    }

    private String resolveDiseaseMasterVersion() {
        if (masterUpdateStore == null) {
            return null;
        }
        try {
            MasterUpdateStore.Snapshot snapshot = masterUpdateStore.getSnapshot();
            MasterUpdateStore.DatasetState state = MasterUpdateStore.findDataset(snapshot, "disease_master");
            if (state == null) {
                state = MasterUpdateStore.findDataset(snapshot, "orca_master_core");
            }
            if (state == null) {
                return null;
            }
            MasterUpdateStore.DatasetVersion version = state.currentVersion();
            if (version != null && version.summary != null && !version.summary.isBlank()) {
                return version.summary;
            }
            return state.currentVersionId;
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private DiseaseProjectionService projectionService() {
        if (diseaseProjectionService == null) {
            diseaseProjectionService = new DiseaseProjectionService();
        }
        return diseaseProjectionService;
    }

    private static LocalDate toDateOnly(Date date) {
        Date safeDate = date != null ? date : new Date();
        return safeDate.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }

    private static String firstDepartmentCode(DiseaseImportResponse response) {
        if (response == null || response.getDiseases() == null) {
            return null;
        }
        for (DiseaseImportResponse.DiseaseEntry entry : response.getDiseases()) {
            if (entry != null && entry.getDepartmentCode() != null && !entry.getDepartmentCode().isBlank()) {
                return entry.getDepartmentCode().trim();
            }
        }
        return null;
    }

    private static String firstInsuranceCombinationNumber(DiseaseImportResponse response) {
        if (response == null || response.getDiseases() == null) {
            return null;
        }
        for (DiseaseImportResponse.DiseaseEntry entry : response.getDiseases()) {
            if (entry != null
                    && entry.getInsuranceCombinationNumber() != null
                    && !entry.getInsuranceCombinationNumber().isBlank()) {
                return entry.getInsuranceCombinationNumber().trim();
            }
        }
        return null;
    }

    private static Map<String, Object> toMirrorItem(DiseaseImportResponse.DiseaseEntry entry) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("diagnosisId", entry.getDiagnosisId());
        item.put("diagnosisName", entry.getDiagnosisName());
        item.put("diagnosisCode", entry.getDiagnosisCode());
        item.put("departmentCode", entry.getDepartmentCode());
        item.put("insuranceCombinationNumber", entry.getInsuranceCombinationNumber());
        item.put("startDate", entry.getStartDate());
        item.put("endDate", entry.getEndDate());
        item.put("outcome", entry.getOutcome());
        item.put("orcaOutcomeSendCode", entry.getOrcaOutcomeSendCode());
        item.put("orcaOutcomeReceivedCode", entry.getOrcaOutcomeReceivedCode());
        item.put("category", entry.getCategory());
        item.put("suspectedFlag", entry.getSuspectedFlag());
        item.put("displayName", entry.getDisplayName());
        item.put("karteName", entry.getKarteName());
        item.put("layer", "orca-mirror");
        item.put("syncState", entry.getSyncState());
        item.put("syncStatus", entry.getSyncStatus());
        item.put("masterVersion", entry.getMasterVersion());
        item.put("orcaSnapshotHash", entry.getOrcaSnapshotHash());
        item.put("components", entry.getComponents());
        item.put("supplements", entry.getSupplements());
        item.put("warnings", entry.getWarnings());
        item.put("unmatchInformation", entry.getUnmatchInformation());
        item.put("readOnly", Boolean.TRUE);
        item.put("candidateOnly", Boolean.FALSE);
        item.put("note", entry.getNote());
        return item;
    }
}
