import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import type { CountryOption } from '@life-abroad/shared';
import { OnboardingForm } from '../src/app/new-game';
import countryCatalog from '../assets/flags/countries.json';
import '../src/styles.css';

const countries: CountryOption[] = countryCatalog.map(country => ({
  id: country.id, name: country.name, isoCode: country.iso, flag: country.flag, timeZone: country.timeZone,
}));

function Fixture() {
  const startsDisconnected = new URLSearchParams(window.location.search).has('error');
  const [catalog, setCatalog] = useState<CountryOption[] | null>(startsDisconnected ? null : countries);
  const [loadError, setLoadError] = useState(startsDisconnected ? 'Could not load countries. Check your connection and try again.' : '');
  return <OnboardingForm countries={catalog} loadError={loadError}
    onRetry={async () => { setCatalog(countries); setLoadError(''); }}
    onComplete={async () => { throw new Error('Connection lost. Your choices are still here.'); }} />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Onboarding fixture root is missing');
createRoot(root).render(<Fixture />);
