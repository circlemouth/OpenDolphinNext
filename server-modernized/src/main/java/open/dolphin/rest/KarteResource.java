package open.dolphin.rest;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;
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
import open.dolphin.rest.support.LegacyOrcaResponseMapper;
import open.dolphin.session.KarteServiceBean;
import open.dolphin.session.UserServiceBean;

/**
 * REST Web Service
 *
 * @author Kazushi Minagawa, Digital Globe, Inc.
 */
@Path("/karte")
public class KarteResource extends AbstractResource {

    @Inject
    private KarteServiceBean karteServiceBean;

    @Inject
    private UserServiceBean userServiceBean;

    @Inject
    private ObjectMapper objectMapper;

    @Context
    private HttpServletRequest httpServletRequest;

    private KarteResourceSupport support() {
        return new KarteResourceSupport(this, karteServiceBean, userServiceBean, objectMapper, httpServletRequest);
    }

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

        String fid = support().requireActorFacilityId(servletReq);
        KarteBean bean = karteServiceBean.getKarte(fid, pid, fromDate);

        return support().toConverter(servletReq, bean, "pid_lookup");
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
        support().ensurePatientFacilityAccess(patientPK, servletReq);

        KarteBean bean = karteServiceBean.getKarte(patientPK, fromDate);
        return support().toConverter(servletReq, bean, "patient_lookup");
    }

    //-------------------------------------------------------

    @GET
    @Path("/docinfo/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public DocInfoListConverter getDocumentList(@Context HttpServletRequest servletReq, @PathParam("param") String param) {

        debug(param);
        String[] params = param != null ? param.split(CAMMA) : new String[0];
        Long karteId = support().parseLongSafely(params, 0);

        String fromParam = support().firstNonEmpty(params, 1, servletReq != null ? servletReq.getParameter("from") : null);
        Date fromDate = support().parseFlexibleDate(fromParam);

        String includeModifiedParam =
                support().firstNonEmpty(params, 2, servletReq != null ? servletReq.getParameter("includeModified") : null);
        boolean includeModified = support().parseBooleanOrDefault(includeModifiedParam, false);

        List<DocInfoModel> result = new ArrayList<>();
        if (karteId != null) {
            support().ensureKarteFacilityAccess(karteId, servletReq);
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

    @GET
    @Path("/documents/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyKarteListResponse.DocumentListResponse getDocuments(@PathParam("param") String param) {

        debug(param);
        String[] params = param.split(CAMMA);
        List<Long> list = new ArrayList<>(params.length);
        for (String s : params) {
            long docId = Long.parseLong(s);
            support().ensureDocumentFacilityAccess(docId, null);
            list.add(docId);
        }

        return support().toLegacyDocumentListResponse(karteServiceBean.getDocumentsAttachmentLight(list));
    } 
    
    @GET
    @Path("/routineMed/list/{karteId}")
    @Produces(MediaType.APPLICATION_JSON)
    public List<RoutineMedicationResponse> getRoutineMedications(@PathParam("karteId") long karteId,
                                                                 @DefaultValue("0") @QueryParam("firstResult") int firstResult,
                                                                 @DefaultValue("50") @QueryParam("maxResults") int maxResults) {
        support().ensureKarteFacilityAccess(karteId, null);
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
        support().ensureKarteFacilityAccess(karteId, null);
        int safeFirst = Math.max(firstResult, 0);
        int safeMax = maxResults > 0 ? Math.min(maxResults, 200) : 50;
        return karteServiceBean.getRoutineMedications(karteId, safeFirst, safeMax);
    }

    @GET
    @Path("/safety/{karteId}")
    @Produces(MediaType.APPLICATION_JSON)
    public SafetySummaryResponse getSafetySummary(@PathParam("karteId") long karteId) {
        support().ensureKarteFacilityAccess(karteId, null);
        return karteServiceBean.getSafetySummary(karteId);
    }

    @GET
    @Path("/rpHistory/list/{karteId}")
    @Produces(MediaType.APPLICATION_JSON)
    public List<RpHistoryEntryResponse> getRpHistory(@PathParam("karteId") long karteId,
                                                     @QueryParam("fromDate") String fromDate,
                                                     @QueryParam("toDate") String toDate,
                                                     @DefaultValue("false") @QueryParam("lastOnly") boolean lastOnly) {
        support().ensureKarteFacilityAccess(karteId, null);
        Date from = support().parseDateAtStart(fromDate);
        Date toExclusive = support().parseDateExclusiveEnd(toDate);
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
        support().ensureKarteFacilityAccess(karteId, null);
        Date from = support().parseDateAtStart(fromDate);
        Date toExclusive = support().parseDateExclusiveEnd(toDate);
        return karteServiceBean.getRpHistory(karteId, from, toExclusive, lastOnly);
    }

    @GET
    @Path("/userProperty/{userId}")
    @Produces(MediaType.APPLICATION_JSON)
    public List<UserPropertyResponse> getUserProperties(@Context HttpServletRequest request, @PathParam("userId") String userId) {
        String actorId = requireRemoteUser(request);
        String targetUserId = support().normalizeTargetUserId(actorId, userId);
        if (targetUserId == null) {
            return Collections.emptyList();
        }
        support().ensureUserPropertyAccess(request, actorId, targetUserId);
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
        support().ensureKarteFacilityAccess(karteId, null);

        List<Date> fromList = new ArrayList<>();
        List<Date> toList = new ArrayList<>();

        int index = 2;

        while (index < params.length) {
            fromList.add(parseDate(params[index++]));
            toList.add(parseDate(params[index++]));
        }

        return support().toLegacyModuleListListResponse(
                karteServiceBean.getModules(karteId, entity, fromList, toList));
    }

    @GET
    @Path("/image/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public SchemaModelConverter getImage(@Context HttpServletRequest servletReq, @PathParam("id") String idStr) {

        debug(idStr);
        long schemaId = Long.parseLong(idStr);
        support().ensureSchemaFacilityAccess(schemaId, servletReq);

        SchemaModel result = karteServiceBean.getImage(schemaId);

        SchemaModelConverter conv = new SchemaModelConverter();
        conv.setModel(result);

        return conv;
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
        support().ensureKarteFacilityAccess(karteId, null);

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
        ObservationList list = support().readJson(json, ObservationList.class);
        List<ObservationModel> observations = list != null ? list.getList() : null;
        if (observations == null) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", "observations が必要です。");
        }
        support().ensureObservationFacilityAccess(observations, null);

        List<Long> result = karteServiceBean.addObservations(observations);

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
        ObservationList list = support().readJson(json, ObservationList.class);
        List<ObservationModel> observations = list != null ? list.getList() : null;
        if (observations == null) {
            throw restError(null, Response.Status.BAD_REQUEST, "invalid_request", "observations が必要です。");
        }
        support().ensureObservationFacilityAccess(observations, null);
        
        int result = karteServiceBean.updateObservations(observations);

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
            support().ensureObservationFacilityAccess(observationId, null);
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
        PatientMemoModel memo = support().readJson(json, PatientMemoModel.class);
        support().ensurePatientMemoFacilityAccess(memo, null);

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
        
        return support().toLegacyPatientFreeDocumentResponse(karteServiceBean.getPatientFreeDocument(fpid));
    }
    
    @PUT
    @Path("/freedocument")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.TEXT_PLAIN)
    public String putPatientFreeDocument(@Context HttpServletRequest servletReq, String json) throws IOException {
        requireRemoteUser(servletReq);
        JsonNode root = objectMapper.readTree(json == null || json.isBlank() ? "{}" : json);
        PatientFreeDocumentModel model = support().readJson(json, PatientFreeDocumentModel.class);

        String fpid = getFidPid(servletReq.getRemoteUser(), model.getFacilityPatId());
        PatientFreeDocumentModel current = karteServiceBean.getPatientFreeDocument(fpid);
        String expectedContentHash = root != null && root.hasNonNull("expectedContentHash")
                ? root.get("expectedContentHash").asText(null)
                : null;
        String currentContentHash = support().patientFreeDocumentContentHash(current);
        if (current != null && (expectedContentHash == null || expectedContentHash.isBlank()
                || !currentContentHash.equalsIgnoreCase(expectedContentHash.trim()))) {
            throw restError(servletReq, Response.Status.CONFLICT,
                    "patient_free_document_conflict",
                    "Patient free document was changed by another editor. Reload before saving.");
        }
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
        support().ensureKarteFacilityAccess(karteId, null);

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
        support().ensureKarteFacilityAccess(karteId, servletReq);
        Date fromDate = parseDate(params[1]+" 00:00:00");
        Date toDate = parseDate(params[2]+" 00:00:00");
        List<String> entities = new ArrayList<String>();
        for (int i=3;i <params.length;i++) {
            entities.add(params[i]);
        }

        return support().toLegacyModuleListResponse(
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
        support().ensurePatientFacilityAccess(pk, null);
        int safeOffset = KarteServiceBean.normalizeDocinfoOffset(offset != null ? offset : 0);
        int safeLimit =
                KarteServiceBean.normalizeDocinfoPageSize(limit != null ? limit : KarteServiceBean.DEFAULT_DOCINFO_PAGE_SIZE);

        return support().toLegacyDocumentListResponse(karteServiceBean.getAllDocument(pk, safeOffset, safeLimit));
    }
//s.oh$
    
//s.oh^ 2014/08/20 添付ファイルの別読
    @GET
    @Path("/attachment/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public AttachmentModelConverter getAttachment(@PathParam("param") String param) {

        long id = Long.parseLong(param);
        support().ensureAttachmentFacilityAccess(id, null);

        AttachmentModel result = karteServiceBean.getAttachment(id);
        
        AttachmentModelConverter conv = new AttachmentModelConverter();
        conv.setModel(result);

        return conv;
    }
//s.oh$

}
