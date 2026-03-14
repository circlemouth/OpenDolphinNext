package open.dolphin.mbean;

import java.util.ArrayList;
import java.util.GregorianCalendar;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.servlet.AsyncContext;
import open.dolphin.infomodel.PatientVisitModel;

/**
 * サーブレットの諸情報を保持するクラス
 * @author masuda, Masuda Naika
 */
@ApplicationScoped
public class ServletContextHolder {

    // 今日と明日
    private GregorianCalendar today;
    private GregorianCalendar tomorrow;

    // Legacy long-poll fallback only. New realtime subscriptions must use SSE.
    private final List<AsyncContext> acList = new ArrayList<>();
    
    // facilityIdとpvtListのマップ
    private final Map<String, List<PatientVisitModel>> pvtListMap 
            = new ConcurrentHashMap<>();
    
    // サーバーのUUID
    private String serverUUID;

    /**
     * @deprecated AsyncContext based delivery is frozen as a legacy fallback.
     * Use the SSE resources instead of registering new long-poll clients.
     */
    @Deprecated(forRemoval = false)
    public List<AsyncContext> getAsyncContextList() {
        return acList;
    }

    /**
     * @deprecated AsyncContext based delivery is frozen as a legacy fallback.
     * Use the SSE resources instead of registering new long-poll clients.
     */
    @Deprecated(forRemoval = false)
    public void addAsyncContext(AsyncContext ac) {
        synchronized (acList) {
            acList.add(ac);
        }
    }

    /**
     * @deprecated AsyncContext based delivery is frozen as a legacy fallback.
     * Use the SSE resources instead of registering new long-poll clients.
     */
    @Deprecated(forRemoval = false)
    public void removeAsyncContext(AsyncContext ac) {
        synchronized (acList) {
            acList.remove(ac);
        }
    }
    
    public String getServerUUID() {
        return serverUUID;
    }
    
    public void setServerUUID(String uuid) {
        serverUUID = uuid;
    }

    public Map<String, List<PatientVisitModel>> getPvtListMap() {
        return pvtListMap;
    }
    
    public List<PatientVisitModel> getPvtList(String fid) {
        List<PatientVisitModel> pvtList = pvtListMap.get(fid);
        if (pvtList == null) {
            pvtList = new CopyOnWriteArrayList<>();
            pvtListMap.put(fid, pvtList);
        }
        return pvtList;
    }

    // 今日と明日を設定する
    public void setToday() {
        today= new GregorianCalendar();
        int year = today.get(GregorianCalendar.YEAR);
        int month = today.get(GregorianCalendar.MONTH);
        int date = today.get(GregorianCalendar.DAY_OF_MONTH);
        today.clear();
        today.set(year, month, date);

        tomorrow = new GregorianCalendar();
        tomorrow.setTime(today.getTime());
        tomorrow.add(GregorianCalendar.DAY_OF_MONTH, 1);
    }
    
    public GregorianCalendar getToday() {
        return today;
    }
    public GregorianCalendar getTomorrow() {
        return tomorrow;
    }

    /**
     * today/tomorrow が未設定の場合のみ初期化する。
     * アプリ起動順序によって setToday が呼ばれないケースのフォールバック。
     */
    public synchronized void ensureDateInitialized() {
        if (today == null || tomorrow == null) {
            setToday();
        }
    }
}
