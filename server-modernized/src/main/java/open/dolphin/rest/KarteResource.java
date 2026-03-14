package open.dolphin.rest;

import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import open.dolphin.converter.*;
import open.dolphin.infomodel.*;
import open.dolphin.rest.dto.LegacyImageRangeResponse;
import open.dolphin.rest.dto.LegacyKarteListResponse;
import open.dolphin.rest.dto.KarteRevisionDocumentResponse;
import open.dolphin.rest.dto.RoutineMedicationResponse;
import open.dolphin.rest.dto.RpHistoryEntryResponse;
import open.dolphin.rest.dto.SafetySummaryResponse;
import open.dolphin.rest.dto.UserPropertyResponse;
import open.dolphin.rest.support.KarteRevisionResponseMapper;
import open.dolphin.rest.support.LegacyJsonSupport;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.UserServiceBean;

/**
 * REST Web Service
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
@Path("/karte")
public class KarteResource extends AbstractResource {

    private static final Logger LOGGER = Logger.getLogger(KarteResource.class.getName());

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private ObjectMapper objectMapper;

    @Context
    private HttpServletRequest httpServletRequest;

    /** Creates a new instance of KarteResource */
    public KarteResource() {
    }

    @GET
    @Path("/pid/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public KarteBeanConverter getKarteByPid(@Context HttpServletRequest servletReq, @PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        String pid = params[0];
        Date fromDate = parseDate(params[1]);

        String fid = resolveFacilityId(servletReq);
        KarteBean bean = karteServiceBean.getKarte(fid, pid, fromDate);

        return toConverter(servletReq, bean, "pid_lookup");
    }

    @GET
    // Avoid capturing sub-resources like "/karte/revisions" with this legacy catch-all route.
    // This route expects a numeric patientPK prefix (optionally followed by ",...").
    @Path("/{param: \\d+.*}")
    @Produces(MediaType.APPLICATION_JSON)
    public KarteBeanConverter getKarte(@Context HttpServletRequest servletReq, @PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        long patientPK = Long.parseLong(params[0]);
        Date fromDate = parseDate(params[1]);
        ensurePatientFacilityAccess(patientPK, servletReq);
        
        KarteBean bean = karteServiceBean.getKarte(patientPK, fromDate);
        return toConverter(servletReq, bean, "patient_lookup");
    }

    //-------------------------------------------------------

    @GET
    @Path("/docinfo/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public DocInfoListConverter getDocumentList(@Context HttpServletRequest servletReq, @PathParam("param") String param) {

        debug(param);
        String[] params = param != null ? param.split(CAMMA) : new String[0];
        Long karteId = parseLongSafely(params, 0);

        String fromParam = firstNonEmpty(params, 1, servletReq != null ? servletReq.getParameter("from") : null);
        Date fromDate = parseFlexibleDate(fromParam);

        String includeModifiedParam =
                firstNonEmpty(params, 2, servletReq != null ? servletReq.getParameter("includeModified") : null);
        boolean includeModified = parseBooleanOrDefault(includeModifiedParam, false);

        List<DocInfoModel> result = new ArrayList<>();
        if (karteId != null) {
            ensureKarteFacilityAccess(karteId, servletReq);
            List<DocInfoModel> fetched = karteServiceBean.getDocumentList(karteId, fromDate, includeModified);
            if (fetched != null) {
                result.addAll(fetched);
            }
        }

        DocInfoList wrapper = new DocInfoList();
        wrapper.setList(result);

        DocInfoListConverter conv = new DocInfoListConverter();
        conv.setModel(wrapper);

        return conv;
    }

    private static String firstNonEmpty(String[] params, int index, String fallback) {
        String candidate = (params != null && params.length > index) ? params[index] : null;
        if (candidate != null && !candidate.isBlank()) {
            return candidate;
        }
        return (fallback != null && !fallback.isBlank()) ? fallback : null;
    }

    private static Long parseLongSafely(String[] params, int index) {
        String candidate = (params != null && params.length > index) ? params[index] : null;
        if (candidate == null || candidate.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(candidate);
        } catch (NumberFormatException e) {
            Logger.getLogger(KarteResource.class.getName()).log(Level.WARNING, "Failed to parse long: " + candidate, e);
            return null;
        }
    }

    private boolean parseBooleanOrDefault(String value, boolean defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        return Boolean.parseBoolean(value);
    }

    private Date parseFlexibleDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        Date parsed = parseDate(value);
        if (parsed != null) {
            return parsed;
        }
        try {
            LocalDate localDate = LocalDate.parse(value);
            return Date.from(localDate.atStartOfDay().toInstant(ZoneOffset.UTC));
        } catch (DateTimeParseException e) {
            Logger.getLogger(KarteResource.class.getName()).log(Level.WARNING, "Failed to parse date: " + value, e);
            return null;
        }
    }

    @GET
    @Path("/documents/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyKarteListResponse.DocumentListResponse getDocuments(@PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        List<Long> list = new ArrayList<>(params.length);
        for (String s : params) {
            long docId = Long.parseLong(s);
            ensureDocumentFacilityAccess(docId, null);
            list.add(docId);
        }

        return toLegacyDocumentListResponse(karteServiceBean.getDocumentsAttachmentLight(list));
    } 
    
    @GET
    @Path("/routineMed/list/{karteId}")
    @Produces(MediaType.APPLICATION_JSON)
    public List<RoutineMedicationResponse> getRoutineMedications(@PathParam("karteId") long karteId,
                                                                 @DefaultValue("0") @QueryParam("firstResult") int firstResult,
                                                                 @DefaultValue("50") @QueryParam("maxResults") int maxResults) {
        ensureKarteFacilityAccess(karteId, null);
        int safeFirst = Math.max(firstResult, 0);
        int safeMax = maxResults > 0 ? Math.min(maxResults, 200) : 50;
        return karteServiceBean.getRoutineMedications(karteId, safeFirst, safeMax);
    }

    @GET
    @Path("/routineMed.list")
    @Produces(MediaType.APPLICATION_JSON)
    public List<RoutineMedicationResponse> getRoutineMedicationsByQuery(@QueryParam("karteId") Long karteId,
                                                                        @DefaultValue("0") @QueryParam("firstResult") int firstResult,
                                                                        @DefaultValue("50") @QueryParam("maxResults") int maxResults) {
        if (karteId == null || karteId <= 0) {
            return Collections.emptyList();
        }
        ensureKarteFacilityAccess(karteId, null);
        int safeFirst = Math.max(firstResult, 0);
        int safeMax = maxResults > 0 ? Math.min(maxResults, 200) : 50;
        return karteServiceBean.getRoutineMedications(karteId, safeFirst, safeMax);
    }

    @GET
    @Path("/safety/{karteId}")
    @Produces(MediaType.APPLICATION_JSON)
    public SafetySummaryResponse getSafetySummary(@PathParam("karteId") long karteId) {
        ensureKarteFacilityAccess(karteId, null);
        return karteServiceBean.getSafetySummary(karteId);
    }

    @GET
    @Path("/rpHistory/list/{karteId}")
    @Produces(MediaType.APPLICATION_JSON)
    public List<RpHistoryEntryResponse> getRpHistory(@PathParam("karteId") long karteId,
                                                     @QueryParam("fromDate") String fromDate,
                                                     @QueryParam("toDate") String toDate,
                                                     @DefaultValue("false") @QueryParam("lastOnly") boolean lastOnly) {
        ensureKarteFacilityAccess(karteId, null);
        Date from = parseDateAtStart(fromDate);
        Date toExclusive = parseDateExclusiveEnd(toDate);
        return karteServiceBean.getRpHistory(karteId, from, toExclusive, lastOnly);
    }

    @GET
    @Path("/rpHistory/list")
    @Produces(MediaType.APPLICATION_JSON)
    public List<RpHistoryEntryResponse> getRpHistoryByQuery(@QueryParam("karteId") Long karteId,
                                                            @QueryParam("fromDate") String fromDate,
                                                            @QueryParam("toDate") String toDate,
                                                            @DefaultValue("false") @QueryParam("lastOnly") boolean lastOnly) {
        if (karteId == null || karteId <= 0) {
            return Collections.emptyList();
        }
        ensureKarteFacilityAccess(karteId, null);
        Date from = parseDateAtStart(fromDate);
        Date toExclusive = parseDateExclusiveEnd(toDate);
        return karteServiceBean.getRpHistory(karteId, from, toExclusive, lastOnly);
    }

    @GET
    @Path("/userProperty/{userId}")
    @Produces(MediaType.APPLICATION_JSON)
    public List<UserPropertyResponse> getUserProperties(@Context HttpServletRequest request, @PathParam("userId") String userId) {
        String actorId = requireRemoteUser(request);
        String targetUserId = normalizeTargetUserId(actorId, userId);
        if (targetUserId == null) {
            return Collections.emptyList();
        }
        ensureUserPropertyAccess(request, actorId, targetUserId);
        return karteServiceBean.getUserProperties(targetUserId);
    }

    //-------------------------------------------------------

    @GET
    @Path("/modules/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyKarteListResponse.ModuleListListResponse getModules(@PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        long karteId = Long.parseLong(params[0]);
        String entity = params[1];
        ensureKarteFacilityAccess(karteId, null);

        List<Date> fromList = new ArrayList<>();
        List<Date> toList = new ArrayList<>();

        int index = 2;

        while (index < params.length) {
            fromList.add(parseDate(params[index++]));
            toList.add(parseDate(params[index++]));
        }

        return toLegacyModuleListListResponse(
                karteServiceBean.getModules(karteId, entity, fromList, toList));
    }

    @GET
    @Path("/image/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public SchemaModelConverter getImage(@Context HttpServletRequest servletReq, @PathParam("id") String idStr) {

        debug(idStr);
        long schemaId = Long.parseLong(idStr);
        ensureSchemaFacilityAccess(schemaId, servletReq);

        SchemaModel result = karteServiceBean.getImage(schemaId);

        SchemaModelConverter conv = new SchemaModelConverter();
        conv.setModel(result);

        return conv;
    }

    //-------------------------------------------------------

    @GET
    @Path("/diagnosis/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public RegisteredDiagnosisListConverter getDiagnosis(@PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        long karteId = Long.parseLong(params[0]);
        Date fromDate = parseDate(params[1]);
        boolean activeOnly = false;
        if (params.length==3) {
            activeOnly = Boolean.parseBoolean(params[2]);
        }
        ensureKarteFacilityAccess(karteId, null);

        List<RegisteredDiagnosisModel> result = karteServiceBean.getDiagnosis(karteId, fromDate, activeOnly);
        RegisteredDiagnosisList list = new RegisteredDiagnosisList();
        list.setList(result);
        
        RegisteredDiagnosisListConverter conv = new RegisteredDiagnosisListConverter();
        conv.setModel(list);

        return conv;
    }
    
    @POST
    @Path("/diagnosis")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String postDiagnosis(String json) throws IOException {
        RegisteredDiagnosisList list = readJson(json, RegisteredDiagnosisList.class);
        ensureDiagnosisFacilityAccess(list != null ? list.getList() : null, null);

        List<Long> result = karteServiceBean.addDiagnosis(list.getList());

        StringBuilder sb = new StringBuilder();
        for (Long l : result) {
            sb.append(String.valueOf(l));
            sb.append(CAMMA);
        }
        String text = sb.substring(0, sb.length()-1);
        debug(text);

        return text;
    }

    @PUT
    @Path("/diagnosis")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putDiagnosis(String json) throws IOException {
        RegisteredDiagnosisList list = readJson(json, RegisteredDiagnosisList.class);
        ensureDiagnosisFacilityAccess(list != null ? list.getList() : null, null);

        int result = karteServiceBean.updateDiagnosis(list.getList());
        String text = String.valueOf(result);
        debug(text);

        return text;
    }

    @DELETE
    @Path("/diagnosis/{param}")
    public void deleteDiagnosis(@PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        List<Long> list = new ArrayList<Long>(params.length);
        for (String s : params) {
            long diagnosisId = Long.parseLong(s);
            ensureDiagnosisIdFacilityAccess(diagnosisId, null);
            list.add(diagnosisId);
        }

        int result = karteServiceBean.removeDiagnosis(list);

        debug(String.valueOf(result));
    }

    //-------------------------------------------------------

    @GET
    @Path("/observations/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public ObservationListConverter getObservations(@PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        long karteId = Long.parseLong(params[0]);
        String observation = params[1];
        String phenomenon = params[2];
        Date firstConfirmed = null;
        if (params.length==4) {
            firstConfirmed = parseDate(params[3]);
        }
        ensureKarteFacilityAccess(karteId, null);

        List<ObservationModel> result = karteServiceBean.getObservations(karteId, observation, phenomenon, firstConfirmed);
        ObservationList list = new ObservationList();
        list.setList(result);
        
        ObservationListConverter conv = new ObservationListConverter();
        conv.setModel(list);

        return conv;
    }

    @POST
    @Path("/observations")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String postObservations(String json) throws IOException {
        ObservationList list = readJson(json, ObservationList.class);
        ensureObservationFacilityAccess(list != null ? list.getList() : null, null);

        List<Long> result = karteServiceBean.addObservations(list.getList());

        StringBuilder sb = new StringBuilder();
        for (Long l : result) {
            sb.append(String.valueOf(l));
            sb.append(CAMMA);
        }
        String text = sb.substring(0, sb.length()-1);
        debug(text);

        return text;
    }

    @PUT
    @Path("/observations")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putObservations(String json) throws IOException {
        ObservationList list = readJson(json, ObservationList.class);
        ensureObservationFacilityAccess(list != null ? list.getList() : null, null);
        
        int result = karteServiceBean.updateObservations(list.getList());

        String text = String.valueOf(result);
        debug(text);

        return text;
    }

    @DELETE
    @Path("/observations/{param}")
    public void deleteObservations(@PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        List<Long> list = new ArrayList<Long>(params.length);
        for (String s : params) {
            long observationId = Long.parseLong(s);
            ensureObservationFacilityAccess(observationId, null);
            list.add(observationId);
        }

        int result = karteServiceBean.removeObservations(list);

        debug(String.valueOf(result));
    }

    //-------------------------------------------------------

    @PUT
    @Path("/memo")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putPatientMemo(String json) throws IOException {
        PatientMemoModel memo = readJson(json, PatientMemoModel.class);
        ensurePatientMemoFacilityAccess(memo, null);

        int result = karteServiceBean.updatePatientMemo(memo);
        String text = String.valueOf(result);
        debug(text);

        return text;
    }
    
//s.oh^ 2014/04/03 サマリー対応
    @GET
    @Path("/freedocument/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyKarteListResponse.PatientFreeDocumentResponse getFreeDocument(@Context HttpServletRequest servletReq, @PathParam("param") String param) {

        String pid = param;
        String fpid = getFidPid(servletReq.getRemoteUser(), pid);
        
        return toLegacyPatientFreeDocumentResponse(karteServiceBean.getPatientFreeDocument(fpid));
    }
    
    @PUT
    @Path("/freedocument")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putPatientFreeDocument(@Context HttpServletRequest servletReq, String json) throws IOException {
        PatientFreeDocumentModel model = readJson(json, PatientFreeDocumentModel.class);
        
        String fpid = getFidPid(servletReq.getRemoteUser(), model.getFacilityPatId());
        model.setFacilityPatId(fpid);

        int result = karteServiceBean.updatePatientFreeDocument(model);
        String text = String.valueOf(result);
        debug(text);

        return text;
    }
//s.oh$

    //-------------------------------------------------------

    @GET
    @Path("/appo/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public AppoListListConverter getAppoinmentList(@PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        long karteId = Long.parseLong(params[0]);
        ensureKarteFacilityAccess(karteId, null);

        List<Date> fromList = new ArrayList<Date>();
        List<Date> toList = new ArrayList<Date>();

        int index = 1;

        while (index < params.length) {
            fromList.add(parseDate(params[index++]));
            toList.add(parseDate(params[index++]));
        }
        
        // Wrapper
        AppoListList wrapper = new AppoListList();

        // List List
        List<List<AppointmentModel>> result = karteServiceBean.getAppointmentList(karteId, fromList, toList);
        for (List<AppointmentModel> list : result) {
            AppoList mlist = new AppoList();
            mlist.setList(list);
            wrapper.addList(mlist);
        }
        
        // Converter
        AppoListListConverter conv = new AppoListListConverter();
        conv.setModel(wrapper);

        return conv;
    }
    
    //--------------------------------------------------------------------------
 //masuda^   
    // 指定したEntityのModuleModelをまとめて取得
    @GET
    @Path("/moduleSearch/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyKarteListResponse.ModuleListResponse getModulesEntitySearch(@Context HttpServletRequest servletReq,@PathParam("param") String param) {

        String fid = getRemoteFacility(servletReq.getRemoteUser());
        
        String[] params = param.split(CAMMA);
        long karteId = Long.parseLong(params[0]);
        ensureKarteFacilityAccess(karteId, servletReq);
        Date fromDate = parseDate(params[1]+" 00:00:00");
        Date toDate = parseDate(params[2]+" 00:00:00");
        List<String> entities = new ArrayList<String>();
        for (int i=3;i <params.length;i++) {
            entities.add(params[i]);
        }

        return toLegacyModuleListResponse(
                karteServiceBean.getModulesEntitySearch(fid, karteId, fromDate, toDate, entities));
    }
//masuda$
    
//s.oh^ 2014/07/22 一括カルテPDF出力
    @GET
    @Path("/docinfo/all/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyKarteListResponse.DocumentListResponse getAllDocument(@PathParam("param") String param,
                                                                       @DefaultValue("0") @QueryParam("offset") Integer offset,
                                                                       @QueryParam("limit") Integer limit) {

        long pk = Long.parseLong(param);
        ensurePatientFacilityAccess(pk, null);
        int safeOffset = KarteServiceBean.normalizeDocinfoOffset(offset != null ? offset : 0);
        int safeLimit =
                KarteServiceBean.normalizeDocinfoPageSize(limit != null ? limit : KarteServiceBean.DEFAULT_DOCINFO_PAGE_SIZE);

        return toLegacyDocumentListResponse(karteServiceBean.getAllDocument(pk, safeOffset, safeLimit));
    }
//s.oh$
    
//s.oh^ 2014/08/20 添付ファイルの別読
    @GET
    @Path("/attachment/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public AttachmentModelConverter getAttachment(@PathParam("param") String param) {

        long id = Long.parseLong(param);
        ensureAttachmentFacilityAccess(id, null);

        AttachmentModel result = karteServiceBean.getAttachment(id);
        
        AttachmentModelConverter conv = new AttachmentModelConverter();
        conv.setModel(result);

        return conv;
    }
//s.oh$

    private KarteBeanConverter toConverter(HttpServletRequest request, KarteBean bean, String context) {
        if (bean == null) {
            Map<String, Object> extras = new HashMap<>();
            extras.put("context", context);
            throw AbstractResource.restError(request, Response.Status.INTERNAL_SERVER_ERROR, "karte_lookup_failed",
                    "Karte result is empty", extras, null);
        }
        KarteBeanConverter conv = new KarteBeanConverter();
        conv.setModel(bean);
        return conv;
    }

    private LegacyKarteListResponse.DocumentListResponse toLegacyDocumentListResponse(List<DocumentModel> documents) {
        if (documents == null || documents.isEmpty()) {
            return LegacyKarteListResponse.DocumentListResponse.ofMapped(List.of());
        }
        List<KarteRevisionDocumentResponse> mapped = new ArrayList<>(documents.size());
        for (DocumentModel document : documents) {
            mapped.add(KarteRevisionResponseMapper.map(document));
        }
        return LegacyKarteListResponse.DocumentListResponse.ofMapped(mapped);
    }

    private LegacyKarteListResponse.ModuleListResponse toLegacyModuleListResponse(List<ModuleModel> modules) {
        return LegacyKarteListResponse.ModuleListResponse.ofMapped(
                KarteRevisionResponseMapper.mapModuleResponses(modules));
    }

    private LegacyKarteListResponse.ModuleListListResponse toLegacyModuleListListResponse(List<List<ModuleModel>> groupedModules) {
        if (groupedModules == null || groupedModules.isEmpty()) {
            return LegacyKarteListResponse.ModuleListListResponse.ofMapped(List.of());
        }
        List<List<KarteRevisionDocumentResponse.ModuleResponse>> mapped = new ArrayList<>(groupedModules.size());
        for (List<ModuleModel> modules : groupedModules) {
            mapped.add(KarteRevisionResponseMapper.mapModuleResponses(modules));
        }
        return LegacyKarteListResponse.ModuleListListResponse.ofMapped(mapped);
    }

    private LegacyKarteListResponse.PatientFreeDocumentResponse toLegacyPatientFreeDocumentResponse(PatientFreeDocumentModel model) {
        if (model == null) {
            return null;
        }
        return LegacyKarteListResponse.PatientFreeDocumentResponse.of(
                model.getId(),
                model.getFacilityPatId(),
                model.getConfirmed(),
                model.getComment());
    }

    private String resolveFacilityId(HttpServletRequest request) {
        String remoteUser = request != null ? request.getRemoteUser() : null;
        String facility = getRemoteFacility(remoteUser);
        if (facility == null || facility.isBlank()) {
            Map<String, Object> extras = new HashMap<>();
            extras.put("remoteUser", remoteUser);
            throw AbstractResource.restError(request, Response.Status.UNAUTHORIZED, "facility_missing",
                    "Facility identifier is not available", extras, null);
        }
        return facility.trim();
    }

    private HttpServletRequest resolveRequest(HttpServletRequest explicit) {
        return explicit != null ? explicit : httpServletRequest;
    }

    private String normalizeTargetUserId(String actorId, String requestedUserId) {
        if (requestedUserId == null || requestedUserId.isBlank()) {
            return null;
        }
        String trimmed = requestedUserId.trim();
        if (trimmed.contains(IInfoModel.COMPOSITE_KEY_MAKER)) {
            return trimmed;
        }
        String facilityId = getRemoteFacility(actorId);
        if (facilityId == null || facilityId.isBlank()) {
            return null;
        }
        return facilityId + IInfoModel.COMPOSITE_KEY_MAKER + trimmed;
    }

    private void ensureUserPropertyAccess(HttpServletRequest request, String actorId, String targetUserId) {
        boolean admin = userServiceBean != null && userServiceBean.isAdmin(actorId);
        if (!admin && !actorId.equals(targetUserId)) {
            throw AbstractResource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied");
        }
        String actorFacility = getRemoteFacility(actorId);
        String targetFacility = getRemoteFacility(targetUserId);
        if (admin && (actorFacility == null || !actorFacility.equals(targetFacility))) {
            throw AbstractResource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied");
        }
    }

    private void ensurePatientFacilityAccess(long patientPk, HttpServletRequest request) {
        if (patientPk <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByPatientPk(patientPk);
        ensureFacilityMatch(actorFacility, targetFacility, "patientPk", patientPk, effectiveRequest);
    }

    private void ensureKarteFacilityAccess(long karteId, HttpServletRequest request) {
        if (karteId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByKarteId(karteId);
        ensureFacilityMatch(actorFacility, targetFacility, "karteId", karteId, effectiveRequest);
    }

    private void ensureDocumentFacilityAccess(long docId, HttpServletRequest request) {
        if (docId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByDocId(docId);
        ensureFacilityMatch(actorFacility, targetFacility, "docId", docId, effectiveRequest);
    }

    private void ensureAttachmentFacilityAccess(long attachmentId, HttpServletRequest request) {
        if (attachmentId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByAttachmentId(attachmentId);
        ensureFacilityMatch(actorFacility, targetFacility, "attachmentId", attachmentId, effectiveRequest);
    }

    private void ensureSchemaFacilityAccess(long schemaId, HttpServletRequest request) {
        if (schemaId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdBySchemaId(schemaId);
        ensureFacilityMatch(actorFacility, targetFacility, "schemaId", schemaId, effectiveRequest);
    }

    private void ensureDiagnosisFacilityAccess(List<RegisteredDiagnosisModel> diagnoses, HttpServletRequest request) {
        if (diagnoses == null || diagnoses.isEmpty()) {
            return;
        }
        Set<Long> karteIds = new LinkedHashSet<>();
        for (RegisteredDiagnosisModel diagnosis : diagnoses) {
            if (diagnosis != null && diagnosis.getKarteBean() != null && diagnosis.getKarteBean().getId() > 0) {
                karteIds.add(diagnosis.getKarteBean().getId());
            }
        }
        for (Long karteId : karteIds) {
            ensureKarteFacilityAccess(karteId, request);
        }
    }

    private void ensureDiagnosisIdFacilityAccess(long diagnosisId, HttpServletRequest request) {
        if (diagnosisId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByDiagnosisId(diagnosisId);
        ensureFacilityMatch(actorFacility, targetFacility, "diagnosisId", diagnosisId, effectiveRequest);
    }

    private void ensureObservationFacilityAccess(List<ObservationModel> observations, HttpServletRequest request) {
        if (observations == null || observations.isEmpty()) {
            return;
        }
        Set<Long> karteIds = new LinkedHashSet<>();
        for (ObservationModel observation : observations) {
            if (observation != null && observation.getKarteBean() != null && observation.getKarteBean().getId() > 0) {
                karteIds.add(observation.getKarteBean().getId());
            }
        }
        for (Long karteId : karteIds) {
            ensureKarteFacilityAccess(karteId, request);
        }
    }

    private void ensureObservationFacilityAccess(long observationId, HttpServletRequest request) {
        if (observationId <= 0) {
            return;
        }
        HttpServletRequest effectiveRequest = resolveRequest(request);
        String actorFacility = resolveFacilityId(effectiveRequest);
        String targetFacility = karteServiceBean.findFacilityIdByObservationId(observationId);
        ensureFacilityMatch(actorFacility, targetFacility, "observationId", observationId, effectiveRequest);
    }

    private void ensurePatientMemoFacilityAccess(PatientMemoModel memo, HttpServletRequest request) {
        if (memo == null || memo.getKarteBean() == null || memo.getKarteBean().getId() <= 0) {
            return;
        }
        ensureKarteFacilityAccess(memo.getKarteBean().getId(), request);
    }

    private void ensureFacilityMatch(String actorFacility,
                                     String targetFacility,
                                     String idName,
                                     long idValue,
                                     HttpServletRequest request) {
        if (actorFacility == null || actorFacility.isBlank()
                || targetFacility == null || targetFacility.isBlank()
                || !actorFacility.equals(targetFacility.trim())) {
            Map<String, Object> details = new HashMap<>();
            details.put("actorFacilityId", actorFacility);
            details.put("targetFacilityId", targetFacility);
            details.put(idName, idValue);
            throw AbstractResource.restError(request, Response.Status.FORBIDDEN, "forbidden", "Access denied",
                    details, null);
        }
    }

    private Date parseDateAtStart(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            LocalDate localDate = LocalDate.parse(value.trim());
            return Date.from(localDate.atStartOfDay(ZoneOffset.UTC).toInstant());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private Date parseDateExclusiveEnd(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            LocalDate next = LocalDate.parse(value.trim()).plusDays(1);
            return Date.from(next.atStartOfDay(ZoneOffset.UTC).toInstant());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    protected <T> T readJson(String json, Class<T> type) throws IOException {
        return LegacyJsonSupport.readBody(json, type, objectMapper);
    }

}
