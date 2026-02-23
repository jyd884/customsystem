const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, skip = 0, limit = 20 } = event;

  try {
    if (action === 'getRecords') {
      const countRes = await db.collection('ocs_records').count();
      const total = countRes.total;

      const recordsRes = await db.collection('ocs_records')
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(limit)
        .get();

      return {
        success: true,
        data: recordsRes.data,
        total
      };
    }
    
    return {
      success: false,
      error: 'Unknown action'
    };
  } catch (err) {
    console.error(err);
    return {
      success: false,
      error: err
    };
  }
};