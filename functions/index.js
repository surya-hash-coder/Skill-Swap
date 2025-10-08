const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

const BREVO_API_KEY = functions.config().brevo.api_key;

// Callable function to send emails via Brevo
exports.sendEmail = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to send emails'
    );
  }

  const { to, subject, htmlContent } = data;

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'SkillSwap',
          email: 'noreply@skillswap.com'
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    if (!response.ok) {
      throw new Error(`Brevo API error: ${response.statusText}`);
    }

    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email');
  }
});

// Scheduled function to send session reminders
exports.reminderScheduler = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    try {
      // Query sessions starting within the next hour
      const sessionsSnapshot = await admin.firestore()
        .collection('sessions')
        .where('startTime', '>=', now)
        .where('startTime', '<=', oneHourFromNow)
        .where('reminderSent', '==', false)
        .get();

      const promises = sessionsSnapshot.docs.map(async (doc) => {
        const session = doc.data();
        
        // Get user profiles
        const [teacherSnapshot, studentSnapshot] = await Promise.all([
          admin.firestore().collection('users').doc(session.teacherId).get(),
          admin.firestore().collection('users').doc(session.studentId).get()
        ]);

        const teacher = teacherSnapshot.data();
        const student = studentSnapshot.data();

        if (!teacher || !student) return;

        // Send reminder to both participants
        const emailPromises = [
          sendReminderEmail(teacher.email, teacher.name, session, student.name),
          sendReminderEmail(student.email, student.name, session, teacher.name)
        ];

        await Promise.all(emailPromises);

        // Mark reminder as sent
        return doc.ref.update({ reminderSent: true });
      });

      await Promise.all(promises);
      console.log(`Sent reminders for ${sessionsSnapshot.size} sessions`);
    } catch (error) {
      console.error('Error in reminder scheduler:', error);
    }
  });

async function sendReminderEmail(userEmail, userName, session, partnerName) {
  const sessionTime = new Date(session.startTime.seconds * 1000).toLocaleString();
  
  const emailData = {
    to: userEmail,
    subject: `SkillSwap Session Reminder: ${session.skill}`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">SkillSwap Session Reminder</h2>
        <p>Hello ${userName},</p>
        <p>This is a reminder for your upcoming SkillSwap session:</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0;">Session Details</h3>
          <p><strong>Skill:</strong> ${session.skill}</p>
          <p><strong>With:</strong> ${partnerName}</p>
          <p><strong>Time:</strong> ${sessionTime}</p>
          <p><strong>Duration:</strong> ${session.duration} minutes</p>
        </div>
        <p>Join your session using this link: <a href="${session.meetingLink}">${session.meetingLink}</a></p>
        <p>Happy learning!</p>
        <p><em>The SkillSwap Team</em></p>
      </div>
    `
  };

  // Use the callable function to send email
  const sendEmail = functions.https.onCall((data) => {
    return sendEmail(data);
  });

  await sendEmail(emailData);
}
