package open.dolphin.rest.orca;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import open.dolphin.rest.dto.orca.OrcaOrderInputSetDetailResponse;
import org.junit.jupiter.api.Test;

class OrcaOrderInputSetSupportTest {

    @Test
    void normalizeClassCodeStripsDotAndLimitsToThreeDigits() {
        assertEquals("212", OrcaOrderInputSetSupport.normalizeClassCode(".212001"));
        assertEquals("900", OrcaOrderInputSetSupport.normalizeClassCode("9001"));
        assertNull(OrcaOrderInputSetSupport.normalizeClassCode(" "));
    }

    @Test
    void toBodyPartCopiesDisplayFields() {
        OrcaOrderInputSetDetailResponse.Item item = new OrcaOrderInputSetDetailResponse.Item();
        item.setCode("0021001");
        item.setName("胸部");
        item.setQuantity("1");
        item.setUnit("部位");
        item.setMemo("");

        OrcaOrderInputSetDetailResponse.BodyPart bodyPart = OrcaOrderInputSetSupport.toBodyPart(item);

        assertEquals("0021001", bodyPart.getCode());
        assertEquals("胸部", bodyPart.getName());
        assertEquals("1", bodyPart.getQuantity());
        assertEquals("部位", bodyPart.getUnit());
    }
}
