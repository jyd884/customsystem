const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const { recordId } = event;

  if (!recordId) {
    return {
      success: false,
      message: 'Missing recordId'
    };
  }

  try {
    const recordRes = await db.collection('ocs_records').doc(recordId).get();
    
    if (recordRes.data) {
      return {
        success: true,
        data: recordRes.data
      };
    } else {
      return {
        success: false,
        message: 'Record not found'
      };
    }
  } catch (err) {
    console.error(err);
    return {
      success: false,
      error: err
    };
  }
};