package open.dolphin.persistence.query;

import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import open.dolphin.infomodel.UserModel;

import java.util.function.Supplier;

/**
 * ユーザー軸の参照クエリを集約する薄い query service。
 */
public class UserQueryService {

    private static final String QUERY_USER_BY_USER_ID = "FROM UserModel u WHERE u.userId=:userId";

    private final Supplier<EntityManager> emProvider;

    public UserQueryService(Supplier<EntityManager> emProvider) {
        this.emProvider = emProvider;
    }

    public UserModel findByCompositeUserId(String compositeUserId) {
        try {
            return emProvider.get().createQuery(QUERY_USER_BY_USER_ID, UserModel.class)
                    .setParameter("userId", compositeUserId)
                    .getSingleResult();
        } catch (NoResultException ex) {
            return null;
        }
    }
}
