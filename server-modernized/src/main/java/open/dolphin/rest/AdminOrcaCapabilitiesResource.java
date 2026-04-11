package open.dolphin.rest;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import open.dolphin.rest.orca.AbstractOrcaRestResource;
import open.dolphin.session.UserServiceBean;

@Path("/admin/orca")
public class AdminOrcaCapabilitiesResource extends AbstractResource {

    @Inject
    private UserServiceBean userServiceBean;

    @GET
    @Path("/capabilities")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getCapabilities(@Context HttpServletRequest request) {
        String runId = AbstractOrcaRestResource.resolveRunIdValue(request);
        requireAdminActor(request, runId);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("runId", runId);
        body.put("ok", true);
        body.put("internalWrappers", List.of(
                capability(
                        "medical-sets",
                        "/api/orca/medical-sets（診療セット）",
                        "official",
                        "stub_fixed",
                        true,
                        "Trial 環境では stub 応答固定（Api_Result=79）"
                ),
                capability(
                        "birth-delivery",
                        "/api/orca/birth-delivery（出産育児一時金）",
                        "official",
                        "stub_fixed",
                        true,
                        "Trial 環境では stub 応答固定（Api_Result=79）"
                ),
                capability(
                        "medical-records",
                        "/api/local/charts/medical-records（院内診療記録取得）",
                        "local",
                        "local_read",
                        true,
                        "official ORCA ではなく院内ローカル保存済みカルテ文書を返します"
                ),
                capability(
                        "patient-mutation",
                        "/api/local/patients/mutation（院内患者作成/更新）",
                        "local",
                        "local_write",
                        true,
                        "official ORCA 互換ではなく院内ローカル患者テーブル更新 contract です"
                ),
                capability(
                        "chart-subjectives",
                        "/api/local/charts/subjectives（院内主訴登録）",
                        "local",
                        "local_write",
                        true,
                        "official subjectivesv2 ではなく院内カルテへの主観記録保存 contract です"
                )
        ));
        return Response.ok(body).header("x-run-id", runId).build();
    }

    private Map<String, Object> capability(String id,
                                           String label,
                                           String routeNamespace,
                                           String behavior,
                                           boolean available,
                                           String hint) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", id);
        item.put("label", label);
        item.put("routeNamespace", routeNamespace);
        item.put("behavior", behavior);
        item.put("available", available);
        item.put("hint", hint);
        return item;
    }

    private String requireAdminActor(HttpServletRequest request, String runId) {
        String actor = request != null ? request.getRemoteUser() : null;
        if (actor == null || actor.isBlank()) {
            throw restError(request, Response.Status.UNAUTHORIZED, "unauthorized", "Authentication required");
        }
        if (userServiceBean == null || !userServiceBean.isAdmin(actor)) {
            throw restError(request, Response.Status.FORBIDDEN, "forbidden", "管理者権限が必要です。");
        }
        return actor;
    }
}
