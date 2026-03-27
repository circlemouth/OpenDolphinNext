package open.dolphin.shared.converter;

import java.util.ArrayList;
import java.util.List;
import open.dolphin.infomodel.BundleDolphin;
import open.dolphin.infomodel.BundleMed;
import open.dolphin.infomodel.ClaimBundle;
import open.dolphin.infomodel.ClaimItem;

public abstract class IClaimBundle<T extends IClaimItem> implements java.io.Serializable {

    private String className;

    private String classCode;

    private String classCodeSystem;

    private String admin;

    private String adminCode;

    private String adminCodeSystem;

    private String adminMemo;

    private String bundleNumber;

    private List<T> claimItems;

    private String memo;

    private String insurance;

    private String orderName;

    protected abstract T createClaimItem();

    public IClaimBundle() {
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public String getClassCode() {
        return classCode;
    }

    public void setClassCode(String classCode) {
        this.classCode = classCode;
    }

    public String getClassCodeSystem() {
        return classCodeSystem;
    }

    public void setClassCodeSystem(String classCodeSystem) {
        this.classCodeSystem = classCodeSystem;
    }

    public String getAdmin() {
        return admin;
    }

    public void setAdmin(String admin) {
        this.admin = admin;
    }

    public String getAdminCode() {
        return adminCode;
    }

    public void setAdminCode(String adminCode) {
        this.adminCode = adminCode;
    }

    public String getAdminCodeSystem() {
        return adminCodeSystem;
    }

    public void setAdminCodeSystem(String adminCodeSystem) {
        this.adminCodeSystem = adminCodeSystem;
    }

    public String getAdminMemo() {
        return adminMemo;
    }

    public void setAdminMemo(String adminMemo) {
        this.adminMemo = adminMemo;
    }

    public String getBundleNumber() {
        return bundleNumber;
    }

    public void setBundleNumber(String bundleNumber) {
        this.bundleNumber = bundleNumber;
    }

    public List<T> getClaimItems() {
        return claimItems == null ? null : new ArrayList<>(claimItems);
    }

    public void setClaimItems(List<T> claimItems) {
        this.claimItems = claimItems == null ? null : new ArrayList<>(claimItems);
    }

    public String getMemo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }

    public String getInsurance() {
        return insurance;
    }

    public void setInsurance(String insurance) {
        this.insurance = insurance;
    }

    public String getOrderName() {
        return orderName;
    }

    public void setOrderName(String orderName) {
        this.orderName = orderName;
    }

    public void fromModel(ClaimBundle model) {
        this.setClassName(model.getClassName());
        this.setClassCode(model.getClassCode());
        this.setClassCodeSystem(model.getClassCodeSystem());
        this.setAdmin(model.getAdmin());
        this.setAdminCode(model.getAdminCode());
        this.setAdminCodeSystem(model.getAdminCodeSystem());
        this.setAdminMemo(model.getAdminMemo());
        this.setBundleNumber(model.getBundleNumber());

        if (model.getClaimItem() != null && model.getClaimItem().length > 0) {
            List<T> list = new ArrayList(model.getClaimItem().length);
            for (ClaimItem ci : model.getClaimItem()) {
                T conv = createClaimItem();
                conv.fromModel(ci);
                list.add(conv);
            }
            this.setClaimItems(list);
        }

        this.setMemo(model.getMemo());
        this.setInsurance(model.getInsurance());
    }

    public ClaimBundle toModel() {
        ClaimBundle ret;

        if (this.orderName != null && this.orderName.equals("処 方")) {
            BundleMed med = new BundleMed();
            med.setOrderName(orderName);
            ret = med;

        } else {
            BundleDolphin bd = new BundleDolphin();
            bd.setOrderName(orderName);
            ret = bd;
        }

        ret.setClassName(this.getClassName());
        ret.setClassCode(this.getClassCode());
        ret.setClassCodeSystem(this.getClassCodeSystem());
        ret.setAdmin(this.getAdmin());
        ret.setAdminCode(this.getAdminCode());
        ret.setAdminCodeSystem(this.getAdminCodeSystem());
        ret.setAdminMemo(this.getAdminMemo());
        ret.setBundleNumber(this.getBundleNumber());

        if (this.getClaimItems() != null && this.getClaimItems().size() > 0) {
            List<ClaimItem> list = new ArrayList(this.getClaimItems().size());
            for (T ci : this.getClaimItems()) {
                list.add(ci.toModel());
            }
            ClaimItem[] items = list.toArray(new ClaimItem[list.size()]);
            ret.setClaimItem(items);
        }

        ret.setMemo(this.getMemo());
        ret.setInsurance(this.getInsurance());

        return ret;
    }
}
