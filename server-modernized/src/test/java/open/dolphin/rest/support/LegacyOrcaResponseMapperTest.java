package open.dolphin.rest.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import open.dolphin.infomodel.DiagnosisCategoryModel;
import open.dolphin.infomodel.DiagnosisOutcomeModel;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.RegisteredDiagnosisModel;
import open.dolphin.infomodel.UserModel;
import org.junit.jupiter.api.Test;

class LegacyOrcaResponseMapperTest {

    @Test
    void registeredDiagnosisResponseUsesLightweightReferencesAndDefaultStatus() {
        RegisteredDiagnosisModel model = new RegisteredDiagnosisModel();
        model.setId(10L);
        model.setDiagnosis("感冒");
        model.setDiagnosisCode("DX01");

        UserModel user = new UserModel();
        user.setId(20L);
        user.setUserId("doctor01");
        model.setUserModel(user);

        KarteBean karte = new KarteBean();
        karte.setId(30L);
        model.setKarteBean(karte);

        DiagnosisCategoryModel category = new DiagnosisCategoryModel();
        category.setDiagnosisCategory("main");
        category.setDiagnosisCategoryDesc("主病名");
        category.setDiagnosisCategoryCodeSys("orca");
        model.setDiagnosisCategoryModel(category);

        DiagnosisOutcomeModel outcome = new DiagnosisOutcomeModel();
        outcome.setOutcome("recovered");
        outcome.setOutcomeDesc("治癒");
        outcome.setOutcomeCodeSys("orca");
        model.setDiagnosisOutcomeModel(outcome);

        LegacyOrcaResponseMapper.RegisteredDiagnosisListResponse response =
                LegacyOrcaResponseMapper.toRegisteredDiagnosisListResponse(List.of(model));

        assertNotNull(response);
        assertNotNull(response.list());
        assertEquals(1, response.list().size());
        var item = response.list().get(0);
        assertEquals(10L, item.id());
        assertEquals("F", item.status());
        assertEquals(20L, item.userModel().id());
        assertEquals(30L, item.karteBean().id());
        assertEquals("main", item.diagnosisCategoryModel().diagnosisCategory());
        assertEquals("recovered", item.diagnosisOutcomeModel().outcome());
    }

    @Test
    void listResponsesCollapseEmptyCollectionsToNullList() {
        assertNull(LegacyOrcaResponseMapper.toTensuListResponse(List.of()).list());
        assertNull(LegacyOrcaResponseMapper.toDiseaseListResponse(List.of()).list());
        assertNull(LegacyOrcaResponseMapper.toRegisteredDiagnosisListResponse(List.of()).list());
    }
}
