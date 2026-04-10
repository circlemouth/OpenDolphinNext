package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import open.dolphin.infomodel.DocumentModel;
import open.dolphin.infomodel.IInfoModel;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleMutationExecutionSupportTest {

    @Test
    void executeAllowsInjectionWithoutAdminCode() {
        OrcaOrderBundleMutationExecutionSupport.MutationResult result = OrcaOrderBundleMutationExecutionSupport.execute(
                buildPayload(buildInjectionUpdateOperation(
                        "admin-a",
                        null,
                        List.of(buildItem("620000010", "drug-a", "main")))),
                null,
                null,
                new HashMap<>(),
                (operation, field, input, required) -> new Date(0L),
                documentId -> null,
                new NoOpPersistence(),
                (documentId, operation, runtimeEx) -> runtimeEx,
                OrcaOrderBundleMutationExecutionSupportTest::validationFailure);

        assertTrue(result.updated().isEmpty());
    }

    @Test
    void executeAllowsInjectionWithoutAdminWhenSendableMainRowExists() {
        OrcaOrderBundleMutationExecutionSupport.MutationResult result = OrcaOrderBundleMutationExecutionSupport.execute(
                buildPayload(buildInjectionUpdateOperation(null, null, List.of(buildItem("620000010", "drug-a", null)))),
                null,
                null,
                new HashMap<>(),
                (operation, field, input, required) -> new Date(0L),
                documentId -> null,
                new NoOpPersistence(),
                (documentId, operation, ex) -> ex,
                OrcaOrderBundleMutationExecutionSupportTest::validationFailure);

        assertTrue(result.updated().isEmpty());
    }

    @Test
    void executeAllowsInjectionWithLocalOnlyAdminCode() {
        OrcaOrderBundleMutationExecutionSupport.MutationResult result = OrcaOrderBundleMutationExecutionSupport.execute(
                buildPayload(buildInjectionUpdateOperation(
                        "admin-b",
                        "Y100",
                        List.of(buildItem("620000010", "drug-a", null)))),
                null,
                null,
                new HashMap<>(),
                (operation, field, input, required) -> new Date(0L),
                documentId -> null,
                new NoOpPersistence(),
                (documentId, operation, runtimeEx) -> runtimeEx,
                OrcaOrderBundleMutationExecutionSupportTest::validationFailure);

        assertTrue(result.updated().isEmpty());
    }

    @Test
    void executeRejectsInjectionWithoutSendableMainRow() {
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> OrcaOrderBundleMutationExecutionSupport.execute(
                        buildPayload(buildInjectionUpdateOperation(
                                "admin-c",
                                "4103",
                                List.of(buildItem("700000031", "drip-set", "material")))),
                        null,
                        null,
                        new HashMap<>(),
                        (operation, field, input, required) -> new Date(0L),
                        documentId -> null,
                        new NoOpPersistence(),
                        (documentId, operation, runtimeEx) -> runtimeEx,
                        OrcaOrderBundleMutationExecutionSupportTest::validationFailure));

        assertTrue(ex.getMessage().contains("items"));
        assertTrue(ex.getMessage().contains("sendable main row"));
    }

    @Test
    void executeRejectsInjectionCommentOnlyBundle() {
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> OrcaOrderBundleMutationExecutionSupport.execute(
                        buildPayload(buildInjectionUpdateOperation(
                                "admin-d",
                                "4103",
                                List.of(buildItem("850100001", "comment-only", "comment")))),
                        null,
                        null,
                        new HashMap<>(),
                        (operation, field, input, required) -> new Date(0L),
                        documentId -> null,
                        new NoOpPersistence(),
                        (documentId, operation, runtimeEx) -> runtimeEx,
                        OrcaOrderBundleMutationExecutionSupportTest::validationFailure));

        assertTrue(ex.getMessage().contains("items"));
        assertTrue(ex.getMessage().contains("sendable main row"));
    }

    @Test
    void executeRejectsInjectionMixedCodedAndUncodedMaterialBundle() {
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> OrcaOrderBundleMutationExecutionSupport.execute(
                        buildPayload(buildInjectionUpdateOperation(
                                "admin-e",
                                "4103",
                                List.of(
                                        buildItem("620000010", "drug-a", "main"),
                                        buildItem(null, "uncoded-material", "material")))),
                        null,
                        null,
                        new HashMap<>(),
                        (operation, field, input, required) -> new Date(0L),
                        documentId -> null,
                        new NoOpPersistence(),
                        (documentId, operation, runtimeEx) -> runtimeEx,
                        OrcaOrderBundleMutationExecutionSupportTest::validationFailure));

        assertTrue(ex.getMessage().contains("items"));
        assertTrue(ex.getMessage().contains("mixed coded and uncoded"));
    }

    @Test
    void executeRejectsInjectionBodyPartOnlyBundle() {
        OrderBundleMutationRequest.BundleOperation operation = buildInjectionUpdateOperation("admin-f", "4103", List.of());
        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("002001");
        bodyPart.setName("body-part");
        operation.setBodyPart(bodyPart);

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> OrcaOrderBundleMutationExecutionSupport.execute(
                        buildPayload(operation),
                        null,
                        null,
                        new HashMap<>(),
                        (operationName, field, input, required) -> new Date(0L),
                        documentId -> null,
                        new NoOpPersistence(),
                        (documentId, operationName, runtimeEx) -> runtimeEx,
                        OrcaOrderBundleMutationExecutionSupportTest::validationFailure));

        assertTrue(ex.getMessage().contains("bodyPart"));
        assertTrue(ex.getMessage().contains("incompatible"));
    }

    @Test
    void executeRejectsInjectionWithNon310ClassCode() {
        OrderBundleMutationRequest.BundleOperation operation =
                buildInjectionUpdateOperation("admin-g", "4103", List.of(buildItem("620000010", "drug-a", "main")));
        operation.setClassCode("400");

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> OrcaOrderBundleMutationExecutionSupport.execute(
                        buildPayload(operation),
                        null,
                        null,
                        new HashMap<>(),
                        (operationName, field, input, required) -> new Date(0L),
                        documentId -> null,
                        new NoOpPersistence(),
                        (documentId, operationName, runtimeEx) -> runtimeEx,
                        OrcaOrderBundleMutationExecutionSupportTest::validationFailure));

        assertTrue(ex.getMessage().contains("classCode"));
        assertTrue(ex.getMessage().contains("incompatible"));
    }

    @Test
    void executeRejectsTreatmentBodyPart() {
        OrderBundleMutationRequest.BundleItem bodyPart = new OrderBundleMutationRequest.BundleItem();
        bodyPart.setCode("002001");
        bodyPart.setName("body-part");

        OrderBundleMutationRequest.BundleOperation operation = new OrderBundleMutationRequest.BundleOperation();
        operation.setOperation("create");
        operation.setEntity("treatmentOrder");
        operation.setClassCode("400");
        operation.setStartDate("2026-04-04");
        operation.setBodyPart(bodyPart);
        operation.setItems(List.of(buildItem("140000610", "procedure", "main")));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> OrcaOrderBundleMutationExecutionSupport.execute(
                        buildPayload(operation),
                        null,
                        null,
                        new HashMap<>(),
                        (operationName, field, input, required) -> new Date(0L),
                        documentId -> null,
                        new NoOpPersistence(),
                        (documentId, operationName, runtimeEx) -> runtimeEx,
                        OrcaOrderBundleMutationExecutionSupportTest::validationFailure));

        assertTrue(ex.getMessage().contains("bodyPart"));
        assertTrue(ex.getMessage().contains("incompatible"));
    }

    @Test
    void executeRejectsBlankClassCodeForExactClassEntities() {
        for (String entity : List.of(
                IInfoModel.ENTITY_MED_ORDER,
                IInfoModel.ENTITY_INJECTION_ORDER,
                IInfoModel.ENTITY_TREATMENT,
                IInfoModel.ENTITY_SURGERY_ORDER,
                "testOrder",
                IInfoModel.ENTITY_PHYSIOLOGY_ORDER,
                IInfoModel.ENTITY_RADIOLOGY_ORDER,
                IInfoModel.ENTITY_BASE_CHARGE_ORDER,
                IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER)) {
            IllegalArgumentException ex = assertThrows(
                    IllegalArgumentException.class,
                    () -> OrcaOrderBundleMutationExecutionSupport.execute(
                            buildPayload(buildExactClassRequiredOperation(entity)),
                            null,
                            null,
                            new HashMap<>(),
                            (operationName, field, input, required) -> new Date(0L),
                            documentId -> null,
                            new NoOpPersistence(),
                            (documentId, operationName, runtimeEx) -> runtimeEx,
                            OrcaOrderBundleMutationExecutionSupportTest::validationFailure));

            assertTrue(ex.getMessage().contains("classCode"));
        }
    }

    @Test
    void executeRejectsMissingEntity() {
        OrderBundleMutationRequest.BundleOperation operation = new OrderBundleMutationRequest.BundleOperation();
        operation.setOperation("create");
        operation.setStartDate("2026-04-04");
        operation.setBundleName("missing-entity");
        operation.setItems(List.of(buildItem("140000610", "procedure-a", "main")));

        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> OrcaOrderBundleMutationExecutionSupport.execute(
                        buildPayload(operation),
                        null,
                        null,
                        new HashMap<>(),
                        (operationName, field, input, required) -> new Date(0L),
                        documentId -> null,
                        new NoOpPersistence(),
                        (documentId, operationName, runtimeEx) -> runtimeEx,
                        OrcaOrderBundleMutationExecutionSupportTest::validationFailure));

        assertTrue(ex.getMessage().contains("entity"));
        assertTrue(ex.getMessage().contains("required"));
    }

    private static OrderBundleMutationRequest buildPayload(OrderBundleMutationRequest.BundleOperation operation) {
        OrderBundleMutationRequest payload = new OrderBundleMutationRequest();
        payload.setOperations(List.of(operation));
        return payload;
    }

    private static OrderBundleMutationRequest.BundleOperation buildInjectionUpdateOperation(
            String admin,
            String adminCode,
            List<OrderBundleMutationRequest.BundleItem> items) {
        OrderBundleMutationRequest.BundleOperation operation = new OrderBundleMutationRequest.BundleOperation();
        operation.setOperation("update");
        operation.setDocumentId(1L);
        operation.setEntity(IInfoModel.ENTITY_INJECTION_ORDER);
        operation.setClassCode("310");
        operation.setStartDate("2026-04-04");
        operation.setAdmin(admin);
        operation.setAdminCode(adminCode);
        operation.setItems(items);
        return operation;
    }

    private static OrderBundleMutationRequest.BundleItem buildItem(String code, String name, String rowRole) {
        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode(code);
        item.setName(name);
        item.setQuantity("1");
        item.setUnit("A");
        item.setRowRole(rowRole);
        return item;
    }

    private static OrderBundleMutationRequest.BundleOperation buildExactClassRequiredOperation(String entity) {
        OrderBundleMutationRequest.BundleOperation operation = new OrderBundleMutationRequest.BundleOperation();
        operation.setOperation("create");
        operation.setEntity(entity);
        operation.setStartDate("2026-04-04");
        operation.setBundleName("class-required");
        operation.setItems(List.of(buildMainItemForEntity(entity)));
        return operation;
    }

    private static OrderBundleMutationRequest.BundleItem buildMainItemForEntity(String entity) {
        return switch (entity) {
            case IInfoModel.ENTITY_MED_ORDER -> buildItem("620000010", "drug-a", "main");
            case IInfoModel.ENTITY_INJECTION_ORDER -> buildItem("620000010", "drug-a", "main");
            case IInfoModel.ENTITY_BASE_CHARGE_ORDER -> buildItem("110000110", "base-charge", "main");
            case IInfoModel.ENTITY_INSTRACTION_CHARGE_ORDER -> buildItem("130000140", "instruction-charge", "main");
            default -> buildItem("140000610", "procedure-a", "main");
        };
    }

    private static IllegalArgumentException validationFailure(String field, String message) {
        return new IllegalArgumentException(field + ":" + message);
    }

    private static final class NoOpPersistence implements OrcaOrderBundleMutationExecutionSupport.Persistence {
        @Override
        public long addDocument(DocumentModel document) {
            return 0L;
        }

        @Override
        public void updateDocument(DocumentModel document) {
        }

        @Override
        public void deleteDocument(long documentId) {
        }

        @Override
        public void flush() {
        }
    }
}
