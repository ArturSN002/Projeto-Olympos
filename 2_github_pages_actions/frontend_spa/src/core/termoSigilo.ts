/**
 * Termo de Sigilo e Conformidade LGPD no Primeiro Acesso Autenticado.
 * Exige aceite explícito antes de liberar operações restritas se `termo_sigilo_aceito_em` estiver vazio.
 */

import { ensureModal } from './routeLoader';

const TERMO_VERSAO_ATUAL = '1.0-LGPD-2026';

export async function verificarEAplicarTermoSigilo(sessao: any): Promise<boolean> {
  if (!sessao || !sessao.perfil) return true;
  const profile = sessao.profile || {};

  if (profile.termo_sigilo_aceito_em) {
    return true;
  }

  try {
    const sessionCacheKey = `olympos_termo_aceito_${sessao.user?.id || sessao.usuario || 'anon'}`;
    if (sessionStorage.getItem(sessionCacheKey) === TERMO_VERSAO_ATUAL) {
      return true;
    }
  } catch {
    // ignora
  }

  await ensureModal('termoSigilo');
  const modal = document.getElementById('termoSigiloModal');
  if (!modal) return true;

  const chk = document.getElementById('termoSigiloCheckbox') as HTMLInputElement | null;
  const btnAceitar = document.getElementById('btnAceitarTermoSigilo') as HTMLButtonElement | null;
  const btnRecusar = document.getElementById('btnRecusarTermoSigilo') as HTMLButtonElement | null;
  const feedback = document.getElementById('termoSigiloFeedback');

  if (chk) chk.checked = false;
  if (btnAceitar) btnAceitar.disabled = true;
  if (feedback) {
    feedback.classList.add('hidden');
    feedback.textContent = '';
  }

  modal.classList.remove('hidden');

  return new Promise<boolean>((resolve) => {
    if (chk && btnAceitar) {
      chk.onchange = () => {
        btnAceitar.disabled = !chk.checked;
      };
    }

    if (btnRecusar) {
      btnRecusar.onclick = () => {
        modal.classList.add('hidden');
        if ((window as any).OlymposApp && typeof (window as any).OlymposApp.fazerLogout === 'function') {
          (window as any).OlymposApp.fazerLogout();
        }
        resolve(false);
      };
    }

    if (btnAceitar) {
      btnAceitar.onclick = async () => {
        if (chk && !chk.checked) return;
        btnAceitar.disabled = true;
        btnAceitar.textContent = 'Registrando aceite...';

        try {
          const supa = (window as any).OlymposSupabase;
          const client = supa && typeof supa.getClient === 'function' ? supa.getClient() : null;
          if (client) {
            const { error } = await client.rpc('aceitar_termo_sigilo', {
              p_versao: TERMO_VERSAO_ATUAL
            });
            if (error) throw error;
          }

          const nowIso = new Date().toISOString();
          if (sessao.profile) {
            sessao.profile.termo_sigilo_aceito_em = nowIso;
            sessao.profile.termo_sigilo_versao = TERMO_VERSAO_ATUAL;
          }
          try {
            const sessionCacheKey = `olympos_termo_aceito_${sessao.user?.id || sessao.usuario || 'anon'}`;
            sessionStorage.setItem(sessionCacheKey, TERMO_VERSAO_ATUAL);
            sessionStorage.setItem('olympos_rbac_profile_cache', JSON.stringify(sessao.profile || {}));
          } catch {
            // ignora
          }

          modal.classList.add('hidden');
          btnAceitar.textContent = 'Aceitar Termo e Continuar';
          if ((window as any).OlymposApp?.showToast) {
            (window as any).OlymposApp.showToast('Termo de Sigilo e LGPD registrado com sucesso.');
          }
          resolve(true);
        } catch (err: any) {
          btnAceitar.disabled = false;
          btnAceitar.textContent = 'Aceitar Termo e Continuar';
          if (feedback) {
            feedback.textContent = err?.message || 'Não foi possível registrar o aceite no momento.';
            feedback.classList.remove('hidden');
          }
        }
      };
    }
  });
}

export const OlymposTermoSigilo = {
  TERMO_VERSAO_ATUAL,
  verificarEAplicarTermoSigilo
};

if (typeof window !== 'undefined') {
  (window as any).OlymposTermoSigilo = OlymposTermoSigilo;
}
