import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Settings, Download, ExternalLink, CheckCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { updateAccounts } from "../utils/accountsApi";
import { apiFetch, apiUrl } from "../utils/apiClient";
import { VersionInfo } from "./VersionInfo";

interface FirstStartupViewProps {
  onComplete: () => void;
}

export function FirstStartupView({ onComplete }: FirstStartupViewProps) {
  const [dropboxUrl, setDropboxUrl] = useState("");
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isUpdatingAccounts, setIsUpdatingAccounts] = useState(false);
  const [urlConfigured, setUrlConfigured] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveDropboxUrl = async () => {
    if (!dropboxUrl.trim()) {
      toast.error("Veuillez saisir une URL Dropbox valide");
      return;
    }

    setIsConfiguring(true);
    try {
  const response = await apiFetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'dropbox_url',
          value: dropboxUrl.trim()
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      setUrlConfigured(true);
      toast.success("URL Dropbox configurée avec succès !");
    } catch (error) {
      console.error('Failed to save dropbox URL:', error);
      toast.error('Échec de la configuration de l\'URL Dropbox');
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleUpdateAccounts = async () => {
    setIsUpdatingAccounts(true);
    try {
      const success = await updateAccounts({
        onSuccess: onComplete,
        successMessage: 'Base de données créée et comptes importés avec succès !',
        errorMessage: 'Échec de la création de la base de données'
      });
    } finally {
      setIsUpdatingAccounts(false);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = ''; // Reset input

    const formData = new FormData();
    formData.append('backup', file);

    const toastId = toast.loading("Importation et restauration de la sauvegarde...");

    try {
      // 1. Upload the backup
      const uploadResponse = await fetch(apiUrl('/api/settings/import-backup'), {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) throw new Error('Échec de l\'upload');
      
      const uploadData = await uploadResponse.json();
      const filename = uploadData.file.filename;

      // 2. Restore the backup
      const restoreResponse = await fetch(apiUrl('/api/settings/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });

      if (!restoreResponse.ok) {
        const errorData = await restoreResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Échec de la restauration');
      }

      toast.dismiss(toastId);
      toast.success("Sauvegarde restaurée avec succès !");
      
      // 3. Complete setup (reload app)
      setTimeout(onComplete, 1500);

    } catch (error) {
      console.error('Error importing backup:', error);
      toast.dismiss(toastId);
      toast.error("Erreur lors de la restauration de la sauvegarde");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Settings className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">
            Bienvenue dans iCompta Budget
          </h1>
          <p className="text-lg text-gray-600">
            Configuration initiale requise pour commencer
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-lg md:col-span-2 border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                Option A : Restaurer une sauvegarde
              </CardTitle>
              <CardDescription>
                Vous avez déjà utilisé l'application et vous possédez un fichier de sauvegarde (.sqlite).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportBackup}
                  accept=".sqlite,.db,.cdb"
                  className="hidden"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importer une sauvegarde
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm uppercase">
            <span className="bg-gradient-to-br from-blue-50 to-indigo-100 px-2 text-gray-500 font-medium">
              Ou démarrer une nouvelle configuration
            </span>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Option B - Étape 1 : Configuration Dropbox
            </CardTitle>
            <CardDescription>
              Configurez l'URL de votre dossier Dropbox contenant le fichier iCompta (.cdb)
              pour permettre l'importation des données de comptes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dropbox-url">URL du dossier Dropbox</Label>
              <Input
                id="dropbox-url"
                type="url"
                value={dropboxUrl}
                onChange={(e) => setDropboxUrl(e.target.value)}
                placeholder="https://dropbox.com/sh/..."
                disabled={urlConfigured}
                className={urlConfigured ? "bg-green-50 border-green-200" : ""}
              />
              <p className="text-sm text-gray-500">
                L'URL doit pointer vers un dossier Dropbox partagé contenant votre fichier de comptes iCompta.
              </p>
            </div>
            
            <div className="flex justify-end">
              {!urlConfigured ? (
                <Button 
                  onClick={handleSaveDropboxUrl}
                  disabled={isConfiguring || !dropboxUrl.trim()}
                  className="min-w-[120px]"
                >
                  {isConfiguring ? "Configuration..." : "Configurer"}
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Configuré</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Option B - Étape 2 : Création de la base de données
            </CardTitle>
            <CardDescription>
              Créez la base de données locale et importez vos comptes depuis Dropbox.
              Cette opération peut prendre quelques minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
              <Button 
                onClick={handleUpdateAccounts}
                disabled={!urlConfigured || isUpdatingAccounts}
                className="min-w-[200px]"
              >
                {isUpdatingAccounts ? (
                  <>
                    <Download className="h-4 w-4 mr-2 animate-pulse" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Créer la base de données
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-2 text-sm text-gray-500">
          <p>
            Une fois la configuration terminée, vous pourrez commencer à gérer vos projets et budgets.
          </p>
          <div className="pt-4 opacity-50">
            <VersionInfo />
          </div>
        </div>
      </div>
    </div>
  );
}
