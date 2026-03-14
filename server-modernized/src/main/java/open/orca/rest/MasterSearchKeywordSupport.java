package open.orca.rest;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

final class MasterSearchKeywordSupport {
    private static final Pattern NUMERIC_CODE_PATTERN = Pattern.compile("^\\d{4,}$");
    private static final Pattern ALPHANUMERIC_CODE_PATTERN = Pattern.compile("^[A-Za-z]\\d{3,}$");

    private MasterSearchKeywordSupport() {
    }

    static void appendOrcaKeywordFilter(StringBuilder where, List<Object> params, String keyword,
            String searchMethod, String codeColumn, String... textColumns) {
        SearchPlan plan = SearchPlan.resolve(keyword, searchMethod);
        if (!plan.hasKeyword()) {
            return;
        }
        List<String> clauses = new ArrayList<>();
        if (codeColumn != null) {
            clauses.add(plan.requiresUpperOnCode()
                    ? "UPPER(CAST(" + codeColumn + " AS VARCHAR)) LIKE ?"
                    : "CAST(" + codeColumn + " AS VARCHAR) LIKE ?");
            params.add(plan.codeLikePattern());
        }
        if (!plan.codePrefixOnly()) {
            for (String textColumn : textColumns) {
                if (textColumn == null) {
                    continue;
                }
                clauses.add("UPPER(CAST(" + textColumn + " AS VARCHAR)) LIKE ?");
                params.add(plan.textLikePattern());
            }
        }
        appendClauses(where, clauses);
    }

    static void appendEtensuKeywordFilter(StringBuilder where, List<Object> params, String keyword,
            String codeColumn, String nameColumn) {
        SearchPlan plan = SearchPlan.resolve(keyword, null);
        if (!plan.hasKeyword()) {
            return;
        }
        List<String> clauses = new ArrayList<>();
        if (codeColumn != null) {
            clauses.add(plan.requiresUpperOnCode()
                    ? "UPPER(" + codeColumn + ") LIKE ?"
                    : codeColumn + " LIKE ?");
            params.add(plan.codeLikePattern());
        }
        if (!plan.codePrefixOnly() && nameColumn != null) {
            clauses.add("UPPER(COALESCE(" + nameColumn + ", '')) LIKE ?");
            params.add(plan.textLikePattern());
        }
        appendClauses(where, clauses);
    }

    private static void appendClauses(StringBuilder where, List<String> clauses) {
        if (!clauses.isEmpty()) {
            where.append(" AND (").append(String.join(" OR ", clauses)).append(")");
        }
    }

    private static final class SearchPlan {
        private final String codeLikePattern;
        private final String textLikePattern;
        private final boolean codePrefixOnly;
        private final boolean requiresUpperOnCode;

        private SearchPlan(String codeLikePattern, String textLikePattern, boolean codePrefixOnly,
                boolean requiresUpperOnCode) {
            this.codeLikePattern = codeLikePattern;
            this.textLikePattern = textLikePattern;
            this.codePrefixOnly = codePrefixOnly;
            this.requiresUpperOnCode = requiresUpperOnCode;
        }

        static SearchPlan resolve(String keyword, String searchMethod) {
            if (keyword == null || keyword.isBlank()) {
                return new SearchPlan(null, null, false, false);
            }
            String trimmedKeyword = keyword.trim();
            String normalizedKeyword = trimmedKeyword.toUpperCase(Locale.ROOT);
            if ("prefix".equals(normalizeSearchMethod(searchMethod))) {
                String prefixLike = normalizedKeyword + "%";
                return new SearchPlan(prefixLike, prefixLike, false, true);
            }
            if ("partial".equals(normalizeSearchMethod(searchMethod))) {
                String partialLike = "%" + normalizedKeyword + "%";
                return new SearchPlan(partialLike, partialLike, false, true);
            }
            if (isCodeLikeKeyword(trimmedKeyword)) {
                return new SearchPlan(normalizedKeyword + "%", null, true, !isNumericCodeKeyword(trimmedKeyword));
            }
            String partialLike = "%" + normalizedKeyword + "%";
            return new SearchPlan(partialLike, partialLike, false, true);
        }

        private static boolean isCodeLikeKeyword(String keyword) {
            return isNumericCodeKeyword(keyword) || ALPHANUMERIC_CODE_PATTERN.matcher(keyword).matches();
        }

        private static boolean isNumericCodeKeyword(String keyword) {
            return NUMERIC_CODE_PATTERN.matcher(keyword).matches();
        }

        private static String normalizeSearchMethod(String searchMethod) {
            if (searchMethod == null || searchMethod.isBlank()) {
                return null;
            }
            String normalized = searchMethod.trim().toLowerCase(Locale.ROOT);
            if ("prefix".equals(normalized) || "partial".equals(normalized)) {
                return normalized;
            }
            return null;
        }

        boolean hasKeyword() {
            return codeLikePattern != null;
        }

        String codeLikePattern() {
            return codeLikePattern;
        }

        String textLikePattern() {
            return textLikePattern;
        }

        boolean codePrefixOnly() {
            return codePrefixOnly;
        }

        boolean requiresUpperOnCode() {
            return requiresUpperOnCode;
        }
    }
}
