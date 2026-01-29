// Debug test page
import { blastApi, sessionsApi, botApi, contactsApi } from '../services/api';

console.log('=== API IMPORT TEST ===');
console.log('blastApi:', blastApi);
console.log('sessionsApi:', sessionsApi);
console.log('botApi:', botApi);
console.log('contactsApi:', contactsApi);
console.log('=======================');

export default function TestImport() {
  return (
    <div style={{padding: '20px', color: 'white'}}>
      <h1>API Import Test</h1>
      <p>Check console for output</p>
      <pre>{JSON.stringify({blastApi: typeof blastApi, sessionsApi: typeof sessionsApi}, null, 2)}</pre>
    </div>
  );
}
