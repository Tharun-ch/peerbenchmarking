//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App.tsx';
import { ErrorFallback } from './ErrorFallback';
import { AuthGate } from './components/auth-gate.component';
import { AuthProvider } from './hooks/use-auth';
import { bootstrapAuth } from './services/rayfin-auth.service';

import './global.css';

const rayfinAuthService = await bootstrapAuth();

function Root() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthProvider rayfinAuthService={rayfinAuthService}>
        <AuthGate>
          <App />
        </AuthGate>
      </AuthProvider>
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
