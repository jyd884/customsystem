const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const { answers, scores, totalScore, advice } = event;

  try {
    const userRes = await db.collection('ocs_users').where({
      _openid: openid
    }).get();

    let userInfo = {};
    if (userRes.data.length > 0) {
      userInfo = userRes.data[0];
      
      if (userInfo.iscomplete) {
        // 查找该用户的最新答题记录
        const recordRes = await db.collection('ocs_records').where({
          _openid: openid
        }).orderBy('createTime', 'desc').limit(1).get();
        
        let recordId = null;
        if (recordRes.data.length > 0) {
          recordId = recordRes.data[0]._id;
        }
        
        return {
          success: false,
          code: 'ALREADY_COMPLETED',
          message: '您已经完成过该问卷了',
          recordId: recordId
        };
      }
      
      // 更新用户的 iscomplete 状态
      await db.collection('ocs_users').doc(userInfo._id).update({
        data: {
          iscomplete: true,
          updateTime: db.serverDate()
        }
      });
    }

    const addRes = await db.collection('ocs_records').add({
      data: {
        _openid: openid,
        userInfo: {
          company: userInfo.company,
          name: userInfo.name,
          position: userInfo.position,
          size: userInfo.size,
          phone: userInfo.phone,
          industry: userInfo.industry
        },
        answers,
        scores,
        totalScore,
        advice,
        createTime: db.serverDate()
      }
    });

    return {
      success: true,
      recordId: addRes._id
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      error: err
    };
  }
};