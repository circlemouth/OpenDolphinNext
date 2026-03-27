/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package open.dolphin.shared.converter;

import java.util.Date;
import open.dolphin.infomodel.KarteBean;
import open.dolphin.infomodel.PatientMemoModel;
import open.dolphin.infomodel.UserModel;

/**
 *
 * @author kazushi
 */
public class IPatientMemoModel {
    
    // PK
    private long id;
    
    // 確定日時 Date
    private String confirmed;
    
    // 記録の有効開始日時(最初に確定した日）Date
    private String started;
    
    // 記録の終了日時（有効ではなくなった日）Date
    private String ended;
    
    // 記録日時 Date
    private String recorded;
    
    // 親エントリーの PK
    private long linkId;
    
    // 親エントリーとの関係
    private String linkRelation;
    
    // エントリーのステータス(Final,Modifyed等）
    private String status;
    
    // 記録責任者（システムの利用者）
    private UserModel userModel;
    
    // カルテへの外部参照
    private KarteBean karteBean;
    
    // memo
    private String memo;
    
    public void fromModel(PatientMemoModel model) {
    
        this.setId(model.getId());
        this.setStarted(IOSHelper.toDateStr(model.getStarted()));
        this.setConfirmed(IOSHelper.toDateStr(model.getConfirmed()));
        this.setRecorded(IOSHelper.toDateStr(model.getRecorded()));
        this.setEnded(IOSHelper.toDateStr(model.getEnded()));
        
        this.setLinkId(model.getLinkId());
        this.setLinkRelation(model.getLinkRelation());
        this.setStatus(model.getStatus());
        
        this.setMemo(model.getMemo());
    }
    
    public PatientMemoModel toModel() {
        
        PatientMemoModel ret = new PatientMemoModel();
        // pk
        ret.setId(this.getId());
        
        // 確定日 Date
        ret.setConfirmed(IOSHelper.toDate(this.getConfirmed()));
        
        // 開始日 Date
        ret.setStarted(IOSHelper.toDate(this.getStarted()));
        
        // 終了日 Date
        ret.setEnded(IOSHelper.toDate(this.getEnded()));
        
        // 記録日 Date
        ret.setRecorded(IOSHelper.toDate(this.getRecorded()));
        
        // リンクpk
        ret.setLinkId(this.getLinkId());
        
        // リンクの関連
        ret.setLinkRelation(this.getLinkRelation());
        
        // ステータス
        ret.setStatus(this.getStatus());
        
        // UserModel 変換なし
        ret.setUserModel(this.getUserModel());
        
        // KarteBean 変換なし
        ret.setKarte(this.getKarteBean());
        
        ret.setMemo(this.getMemo());
        
        return ret;
    }

    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getConfirmed() {
        return confirmed;
    }

    public void setConfirmed(String confirmed) {
        this.confirmed = confirmed;
    }

    public String getStarted() {
        return started;
    }

    public void setStarted(String started) {
        this.started = started;
    }

    public String getEnded() {
        return ended;
    }

    public void setEnded(String ended) {
        this.ended = ended;
    }

    public String getRecorded() {
        return recorded;
    }

    public void setRecorded(String recorded) {
        this.recorded = recorded;
    }

    public long getLinkId() {
        return linkId;
    }

    public void setLinkId(long linkId) {
        this.linkId = linkId;
    }

    public String getLinkRelation() {
        return linkRelation;
    }

    public void setLinkRelation(String linkRelation) {
        this.linkRelation = linkRelation;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public UserModel getUserModel() {
        return copyUserReference(userModel);
    }

    public void setUserModel(UserModel userModel) {
        this.userModel = copyUserReference(userModel);
    }

    public KarteBean getKarteBean() {
        return copyKarteReference(karteBean);
    }

    public void setKarteBean(KarteBean karteBean) {
        this.karteBean = copyKarteReference(karteBean);
    }

    public String getMemo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }

    private static UserModel copyUserReference(UserModel source) {
        if (source == null) {
            return null;
        }
        UserModel copy = new UserModel();
        copy.setId(source.getId());
        copy.setUserId(source.getUserId());
        copy.setCommonName(source.getCommonName());
        copy.setSirName(source.getSirName());
        copy.setGivenName(source.getGivenName());
        copy.setLicenseModel(source.getLicenseModel());
        copy.setFacilityModel(source.getFacilityModel());
        copy.setMemberType(source.getMemberType());
        copy.setMemo(source.getMemo());
        copy.setRegisteredDate(source.getRegisteredDate() == null ? null : new Date(source.getRegisteredDate().getTime()));
        return copy;
    }

    private static KarteBean copyKarteReference(KarteBean source) {
        if (source == null) {
            return null;
        }
        KarteBean copy = new KarteBean();
        copy.setId(source.getId());
        return copy;
    }
}
