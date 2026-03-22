package open.dolphin.session;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import open.dolphin.infomodel.UserModel;
import open.dolphin.rest.dto.UserPropertyResponse;

final class KarteUserPropertySupport {

    private static final DateTimeFormatter ISO_INSTANT_FORMATTER = DateTimeFormatter.ISO_INSTANT;

    List<UserPropertyResponse> toResponses(UserModel user) {
        if (user == null) {
            return Collections.emptyList();
        }
        List<UserPropertyResponse> responses = new ArrayList<>();
        long seq = 1L;
        String updatedAt = formatIso(user.getRegisteredDate());

        if (hasText(user.getCommonName())) {
            responses.add(new UserPropertyResponse(seq++, "担当医", user.getCommonName().trim(), null, "プロフィール", updatedAt));
        }
        if (user.getDepartmentModel() != null && hasText(user.getDepartmentModel().getDepartmentDesc())) {
            responses.add(new UserPropertyResponse(
                    seq++,
                    "診療科",
                    user.getDepartmentModel().getDepartmentDesc().trim(),
                    null,
                    "プロフィール",
                    updatedAt));
        }
        if (hasText(user.getOrcaId())) {
            responses.add(new UserPropertyResponse(
                    seq++,
                    "ORCA ID",
                    user.getOrcaId().trim(),
                    "ORCA 連携で使用するユーザーコード",
                    "システム",
                    updatedAt));
        }
        if (hasText(user.getMemo())) {
            responses.add(new UserPropertyResponse(seq++, "ユーザーメモ", user.getMemo().trim(), null, "メモ", updatedAt));
        }
        return responses;
    }

    private String formatIso(Date date) {
        if (date == null) {
            return null;
        }
        Instant instant = date.toInstant();
        return ISO_INSTANT_FORMATTER.format(instant);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
