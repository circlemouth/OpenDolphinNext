package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.List;
import open.dolphin.rest.dto.orca.OrderBundleMutationRequest;
import org.junit.jupiter.api.Test;

class OrcaOrderBundleMutationExecutionSupportTest {

    @Test
    void rejectsInjectionWithAdminButMissingAdminCode() {
        OrderBundleMutationRequest payload = payload(newInjectionOperation(
                "静注",
                null,
                List.of(mainDrug("620000001", "main-drug"))));

        IllegalArgumentException exception = assertValidationFailure(payload);

        assertEquals("adminCode:adminCode is required when admin is provided", exception.getMessage());
    }

    @Test
    void rejectsInjectionCommentOnlyBundle() {
        OrderBundleMutationRequest payload = payload(newInjectionOperation(
                "静注",
                "4101",
                List.of(commentRow("0085001", "comment-only"))));

        IllegalArgumentException exception = assertValidationFailure(payload);

        assertEquals("items:items do not contain a sendable main row", exception.getMessage());
    }

    @Test
    void rejectsInjectionMaterialOnlyBundle() {
        OrderBundleMutationRequest payload = payload(newInjectionOperation(
                "静注",
                "4101",
                List.of(materialRow("700000001", "material-only"))));

        IllegalArgumentException exception = assertValidationFailure(payload);

        assertEquals("items:items do not contain a sendable main row", exception.getMessage());
    }

    @Test
    void rejectsInjectionMixedCodedAndUncodedMaterialBundle() {
        OrderBundleMutationRequest payload = payload(newInjectionOperation(
                "静注",
                "4101",
                List.of(mainDrug("620000001", "main-drug"), materialRow(null, "uncoded-material"))));

        IllegalArgumentException exception = assertValidationFailure(payload);

        assertEquals("items:items contain mixed coded and uncoded rows", exception.getMessage());
    }

    @Test
    void rejectsInjectionBodyPartOnlyBundle() {
        OrderBundleMutationRequest payload = payload(newInjectionOperation(
                "静注",
                "4101",
                List.of()));
        payload.getOperations().get(0).setBodyPart(bodyPart("002001", "chest"));

        IllegalArgumentException exception = assertValidationFailure(payload);

        assertEquals("bodyPart:bodyPart is incompatible with entity", exception.getMessage());
    }

    @Test
    void rejectsInjectionUsageOnlyBundle() {
        OrderBundleMutationRequest payload = payload(newInjectionOperation(
                "静注",
                "4101",
                List.of()));

        IllegalArgumentException exception = assertValidationFailure(payload);

        assertEquals("items:items do not contain a sendable main row", exception.getMessage());
    }

    @Test
    void rejectsInjectionWithNon310ClassCode() {
        OrderBundleMutationRequest payload = payload(newInjectionOperation(
                "静注",
                "4101",
                List.of(mainDrug("620000001", "main-drug"))));
        payload.getOperations().get(0).setClassCode("400");

        IllegalArgumentException exception = assertValidationFailure(payload);

        assertEquals("classCode:classCode is incompatible with entity", exception.getMessage());
    }

    private static IllegalArgumentException assertValidationFailure(OrderBundleMutationRequest payload) {
        return assertThrows(IllegalArgumentException.class, () -> invokeValidationOnly(payload));
    }

    private static void invokeValidationOnly(OrderBundleMutationRequest payload) {
        try {
            Method method = OrcaOrderBundleMutationExecutionSupport.class.getDeclaredMethod(
                    "validateOperationStructure",
                    OrderBundleMutationRequest.BundleOperation.class,
                    OrcaOrderBundleMutationExecutionSupport.ValidationFailure.class);
            method.setAccessible(true);
            method.invoke(
                    null,
                    payload.getOperations().get(0),
                    (OrcaOrderBundleMutationExecutionSupport.ValidationFailure) (field, message) ->
                            new IllegalArgumentException(field + ":" + message));
        } catch (InvocationTargetException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw new RuntimeException(cause);
        } catch (ReflectiveOperationException ex) {
            throw new RuntimeException(ex);
        }
    }

    private static OrderBundleMutationRequest payload(OrderBundleMutationRequest.BundleOperation operation) {
        OrderBundleMutationRequest request = new OrderBundleMutationRequest();
        request.setPatientId("00001");
        request.setOperations(List.of(operation));
        return request;
    }

    private static OrderBundleMutationRequest.BundleOperation newInjectionOperation(
            String admin,
            String adminCode,
            List<OrderBundleMutationRequest.BundleItem> items) {
        OrderBundleMutationRequest.BundleOperation operation = new OrderBundleMutationRequest.BundleOperation();
        operation.setOperation("create");
        operation.setEntity("injectionOrder");
        operation.setBundleName("injection-bundle");
        operation.setClassCode("310");
        operation.setClassCodeSystem("Claim007");
        operation.setStartDate("2025-01-01");
        operation.setAdmin(admin);
        operation.setAdminCode(adminCode);
        operation.setAdminCodeSystem("Claim007");
        operation.setItems(items);
        return operation;
    }

    private static OrderBundleMutationRequest.BundleItem mainDrug(String code, String name) {
        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode(code);
        item.setName(name);
        item.setQuantity("1");
        item.setUnit("ampoule");
        item.setRowRole("main");
        return item;
    }

    private static OrderBundleMutationRequest.BundleItem materialRow(String code, String name) {
        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode(code);
        item.setName(name);
        item.setQuantity("1");
        item.setUnit("set");
        item.setRowRole("material");
        return item;
    }

    private static OrderBundleMutationRequest.BundleItem commentRow(String code, String name) {
        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode(code);
        item.setName(name);
        item.setRowRole("comment");
        return item;
    }

    private static OrderBundleMutationRequest.BundleItem bodyPart(String code, String name) {
        OrderBundleMutationRequest.BundleItem item = new OrderBundleMutationRequest.BundleItem();
        item.setCode(code);
        item.setName(name);
        item.setQuantity("1");
        item.setUnit("part");
        item.setRowRole("bodyPart");
        return item;
    }
}
