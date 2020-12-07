import sengdrid from '@sendgrid/mail';

sengdrid.setApiKey(process.env.SENDGRID_API_KEY);

export default sengdrid;
