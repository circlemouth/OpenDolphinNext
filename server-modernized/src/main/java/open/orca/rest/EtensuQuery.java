package open.orca.rest;

import java.util.List;

final class EtensuQuery {
    final String whereClause;
    final List<Object> params;

    EtensuQuery(String whereClause, List<Object> params) {
        this.whereClause = whereClause;
        this.params = params;
    }
}
