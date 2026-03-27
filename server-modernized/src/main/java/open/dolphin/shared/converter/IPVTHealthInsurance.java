package open.dolphin.shared.converter;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import open.dolphin.infomodel.PVTHealthInsuranceModel;
import open.dolphin.infomodel.PVTPublicInsuranceItemModel;

public abstract class IPVTHealthInsurance<T extends IPVTPublicInsuranceItem> implements java.io.Serializable {

    private String uuid;

    private String insuranceClass;

    private String insuranceClassCode;

    private String insuranceClassCodeSys;

    private String insuranceNumber;

    private String clientGroup;

    private String clientNumber;

    private String familyClass;

    private String startDate;

    private String expiredDate;

    private List<String> continuedDisease;

    private String payInRatio;

    private String payOutRatio;

    private List<T> publicItems;

    protected abstract T createPublicInsuranceItem();

    public IPVTHealthInsurance() {
        super();
    }

    public String getGUID() {
        return uuid;
    }

    public void setGUID(String uuid) {
        this.uuid = uuid;
    }

    public String getInsuranceClass() {
        return insuranceClass;
    }

    public void setInsuranceClass(String insuranceClass) {
        this.insuranceClass = insuranceClass;
    }

    public String getInsuranceClassCode() {
        return insuranceClassCode;
    }

    public void setInsuranceClassCode(String insuranceClassCode) {
        this.insuranceClassCode = insuranceClassCode;
    }

    public String getInsuranceClassCodeSys() {
        return insuranceClassCodeSys;
    }

    public void setInsuranceClassCodeSys(String insuranceClassCodeSys) {
        this.insuranceClassCodeSys = insuranceClassCodeSys;
    }

    public String getInsuranceNumber() {
        return insuranceNumber;
    }

    public void setInsuranceNumber(String insuranceNumber) {
        this.insuranceNumber = insuranceNumber;
    }

    public String getClientGroup() {
        return clientGroup;
    }

    public void setClientGroup(String clientGroup) {
        this.clientGroup = clientGroup;
    }

    public String getClientNumber() {
        return clientNumber;
    }

    public void setClientNumber(String clientNumber) {
        this.clientNumber = clientNumber;
    }

    public String getFamilyClass() {
        return familyClass;
    }

    public void setFamilyClass(String familyClass) {
        this.familyClass = familyClass;
    }

    public String getStartDate() {
        return startDate;
    }

    public void setStartDate(String startDate) {
        this.startDate = startDate;
    }

    public String getExpiredDate() {
        return expiredDate;
    }

    public void setExpiredDate(String expiredDate) {
        this.expiredDate = expiredDate;
    }

    public List<String> getContinuedDisease() {
        return continuedDisease == null ? null : new ArrayList<>(continuedDisease);
    }

    public void setContinuedDisease(List<String> continuedDisease) {
        this.continuedDisease = continuedDisease == null ? null : new ArrayList<>(continuedDisease);
    }

    public String getPayInRatio() {
        return payInRatio;
    }

    public void setPayInRatio(String payInRatio) {
        this.payInRatio = payInRatio;
    }

    public String getPayOutRatio() {
        return payOutRatio;
    }

    public void setPayOutRatio(String payOutRatio) {
        this.payOutRatio = payOutRatio;
    }

    public List<T> getPublicItems() {
        return publicItems == null ? null : new ArrayList<>(publicItems);
    }

    public void setPublicItems(List<T> publicItems) {
        this.publicItems = publicItems == null ? null : new ArrayList<>(publicItems);
    }

    public void fromModel(PVTHealthInsuranceModel model) {
        this.setGUID(model.getGUID());
        this.setInsuranceClass(model.getInsuranceClass());
        this.setInsuranceClassCode(model.getInsuranceClassCode());
        this.setInsuranceClassCodeSys(model.getInsuranceClassCodeSys());
        this.setInsuranceNumber(model.getInsuranceNumber());
        this.setClientGroup(model.getClientGroup());
        this.setClientNumber(model.getClientNumber());
        this.setFamilyClass(model.getFamilyClass());
        this.setStartDate(model.getStartDate());
        this.setExpiredDate(model.getExpiredDate());
        this.setPayInRatio(model.getPayInRatio());
        this.setPayOutRatio(model.getPayOutRatio());

        if (model.getContinuedDisease() != null && model.getContinuedDisease().length > 0) {
            String[] arr = model.getContinuedDisease();
            this.setContinuedDisease(Arrays.asList(arr));
        }

        if (model.getPublicItems() != null && model.getPublicItems().size() > 0) {
            List<T> list = new ArrayList();
            for (PVTPublicInsuranceItemModel item : model.getPublicItems()) {
                T p = createPublicInsuranceItem();
                p.fromModel(item);
                list.add(p);
            }
            this.setPublicItems(list);
        }
    }

    public PVTHealthInsuranceModel toModel() {
        PVTHealthInsuranceModel ret = new PVTHealthInsuranceModel();
        ret.setGUID(this.getGUID());
        ret.setInsuranceClass(this.getInsuranceClass());
        ret.setInsuranceClassCode(this.getInsuranceClassCode());
        ret.setInsuranceClassCodeSys(this.getInsuranceClassCodeSys());
        ret.setInsuranceNumber(this.getInsuranceNumber());
        ret.setClientGroup(this.getClientGroup());
        ret.setClientNumber(this.getClientNumber());
        ret.setFamilyClass(this.getFamilyClass());
        ret.setStartDate(this.getStartDate());
        ret.setExpiredDate(this.getExpiredDate());
        ret.setPayInRatio(this.getPayInRatio());
        ret.setPayOutRatio(this.getPayOutRatio());

        if (this.getContinuedDisease() != null && this.getContinuedDisease().size() > 0) {
            String[] arr = this.getContinuedDisease().toArray(new String[this.getContinuedDisease().size()]);
            ret.setContinuedDisease(arr);
        }

        if (this.getPublicItems() != null && this.getPublicItems().size() > 0) {
            List<PVTPublicInsuranceItemModel> list = new ArrayList<PVTPublicInsuranceItemModel>();
            for (T item : this.getPublicItems()) {
                PVTPublicInsuranceItemModel model = item.toModel();
                list.add(model);
            }
            PVTPublicInsuranceItemModel[] arr = list.toArray(new PVTPublicInsuranceItemModel[list.size()]);
            ret.setPVTPublicInsuranceItem(arr);
        }
        return ret;
    }
}
