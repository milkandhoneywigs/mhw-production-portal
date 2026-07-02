import { redirect } from 'next/navigation';

// The Master Portal opens the existing Production Portal (Mabel workflow) via a
// clean /production route. The detailed production dashboard lives at /dashboard.
export default function ProductionEntry() {
  redirect('/dashboard');
}
