const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const { company, name, position, size, phone, industry } = event;

  try {
    // 检查是否已经存在相同姓名和电话的用户
    const existingUserRes = await db.collection('ocs_users').where({
      name: name,
      phone: phone
    }).get();

    if (existingUserRes.data.length > 0) {
      const user = existingUserRes.data[0];
      if (user.iscomplete) {
        // 查找该用户的最新答题记录
        const recordRes = await db.collection('ocs_records').where(db.command.or([
          { userId: user._id },
          { 
            _openid: user._openid,
            'userInfo.name': user.name,
            'userInfo.phone': user.phone
          }
        ])).orderBy('createTime', 'desc').limit(1).get();
        
        let recordId = null;
        if (recordRes.data.length > 0) {
          recordId = recordRes.data[0]._id;
        }
        
        return {
          success: true,
          iscomplete: true,
          recordId: recordId,
          userId: user._id,
          openid: user._openid
        };
      } else {
        return {
          success: true,
          iscomplete: false,
          userId: user._id,
          openid: user._openid
        };
      }
    }

    // 如果不存在，则新增记录
    const addRes = await db.collection('ocs_users').add({
      data: {
        _openid: openid,
        company, name, position, size, phone, industry,
        iscomplete: false,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      userId: addRes._id,
      openid
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      error: err
    };
  }
};