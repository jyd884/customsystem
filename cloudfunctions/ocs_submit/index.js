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