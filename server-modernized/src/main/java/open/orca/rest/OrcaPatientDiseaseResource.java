package open.orca.rest;

import jakarta.ejb.EJB;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import open.dolphin.rest.support.LegacyOrcaResponseMapper;

@Path("/orca/disease")
public class OrcaPatientDiseaseResource {

    @EJB
    private OrcaResource orcaResource;

    @GET
    @Path("/name/{param}/")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyOrcaResponseMapper.DiseaseListResponse getDiseaseByName(@PathParam("param") String param) {
        return orcaResource.getDiseaseByName(param);
    }

    @GET
    @Path("/import/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyOrcaResponseMapper.RegisteredDiagnosisListResponse getOrcaDisease(
            @PathParam("param") String param,
            @QueryParam("from") String fromQuery,
            @QueryParam("to") String toQuery,
            @QueryParam("activeOnly") String activeOnlyQuery,
            @QueryParam("ascend") String ascendQuery) {
        return orcaResource.getOrcaDisease(param, fromQuery, toQuery, activeOnlyQuery, ascendQuery);
    }

    @GET
    @Path("/active/{param}")
    @Produces(MediaType.APPLICATION_JSON)
    public LegacyOrcaResponseMapper.RegisteredDiagnosisListResponse getActiveOrcaDisease(@PathParam("param") String param) {
        return orcaResource.getActiveOrcaDisease(param);
    }
}
