import { toast } from "sonner";

interface UpdateAccountsOptions {
  requireDropboxUrl?: boolean;
  dropboxUrl?: string;
  onSuccess?: () => void;
  successMessage?: string;
  errorMessage?: string;
}

export async function updateAccounts({
  requireDropboxUrl = false,
  dropboxUrl,
  onSuccess,
  successMessage = 'Comptes mis à jour avec succès !',
  errorMessage = 'Échec de la mise à jour des comptes'
}: UpdateAccountsOptions = {}): Promise<boolean> {
  try {
    // Vérifier l'URL Dropbox si requise
    if (requireDropboxUrl && !dropboxUrl) {
      toast.error('Veuillez d\'abord configurer l\'URL Dropbox');
      return false;
    }

  const response = await fetch('/api/update-accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    toast.success(result.message || successMessage);
    
    // Appeler la fonction de succès si fournie
    if (onSuccess) {
      // Attendre un peu pour que l'utilisateur voie le message de succès
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to update accounts:', error);
    toast.error((error as Error).message || errorMessage);
    return false;
  }
}
