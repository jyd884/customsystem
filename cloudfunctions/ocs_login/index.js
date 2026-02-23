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
      return {
        success: false,
        code: 'ALREADY_EXISTS',
        message: '您已经完成了该测评'
      };
    }

    // 如果不存在，则新增记录
    const addRes = await db.collection('ocs_users').add({
      data: {
        _openid: openid,
        company, name, position, size, phone, industry,
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