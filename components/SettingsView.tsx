import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Settings, Save, Check, Download, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../utils/apiClient";
import { updateAccounts } from "../utils/accountsApi";
import { VersionInfo } from "./VersionInfo";


interface AccountPreference {
  accountId: string;
  accountName: string;
  includeSavings: boolean;
  includeChecking: boolean;
}

interface SettingsViewProps {
  dropboxUrl: string;
  onUpdateDropboxUrl: (url: string) => void;
}

export function SettingsView({ dropboxUrl, onUpdateDropboxUrl }: SettingsViewProps) {
  const [editUrl, setEditUrl] = useState(dropboxUrl);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingAccounts, setIsUpdatingAccounts] = useState(false);
  const [accountPreferences, setAccountPreferences] = useState<AccountPreference[]>([]);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [isRefreshingAccounts, setIsRefreshingAccounts] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  useEffect(() => {
    setEditUrl(dropboxUrl);
  }, [dropboxUrl]);

  useEffect(() => {
    loadAccountPreferences();
  }, []);

  const loadAccountPreferences = async () => {
    setIsLoadingPreferences(true);
    try {
    const response = await apiFetch('/api/account-preferences');
      if (response.ok) {
        const preferences = await response.json();
        setAccountPreferences(preferences);
      }
    } catch (error) {
      console.error('Error loading account preferences:', error);
      toast.error("Erreur lors du chargement des préférences de comptes");
    } finally {
      setIsLoadingPreferences(false);
    }
  };

  const refreshAccountList = async () => {
    setIsRefreshingAccounts(true);
    try {
    const response = await apiFetch('/api/account-preferences/refresh', {
        method: 'POST',
      });
      
      if (response.ok) {
        await loadAccountPreferences();
        toast.success("Liste des comptes mise à jour !");
      } else {
        throw new Error('Failed to refresh accounts');
      }
    } catch (error) {
      console.error('Error refreshing accounts:', error);
      toast.error("Erreur lors de la mise à jour des comptes");
    } finally {
      setIsRefreshingAccounts(false);
    }
  };

  const updateAccountPreference = async (accountId: string, accountName: string, field: 'includeSavings' | 'includeChecking', value: boolean) => {
    try {
      // Find current preference
      const currentPref = accountPreferences.find(p => p.accountId === accountId);
      if (!currentPref) return;

      const updatedPref = { ...currentPref, [field]: value };

    const response = await apiFetch('/api/account-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          accountName,
          includeSavings: updatedPref.includeSavings,
          includeChecking: updatedPref.includeChecking
        }),
      });

      if (response.ok) {
        // Update local state
        setAccountPreferences(prev => 
          prev.map(pref => 
            pref.accountId === accountId 
              ? updatedPref
              : pref
          )
        );
        
        const fieldLabel = field === 'includeSavings' ? 'épargne' : 'dépenses';
        toast.success(value ? `Compte inclus dans les calculs d'${fieldLabel}` : `Compte exclu des calculs d'${fieldLabel}`);
      } else {
        throw new Error('Failed to update preference');
      }
    } catch (error) {
      console.error('Error updating account preference:', error);
      toast.error("Erreur lors de la mise à jour de la préférence");
    }
  };

  const saveAllPreferences = async () => {
    setIsSavingPreferences(true);
    try {
    const response = await apiFetch('/api/account-preferences/save-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: accountPreferences
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Préférences sauvegardées ! (${result.saved} comptes)`);
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error("Erreur lors de la sauvegarde des préférences");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  // Fonctions pour sélectionner/désélectionner tous les comptes
  const toggleAllSavings = (checked: boolean) => {
    setAccountPreferences(prev => 
      prev.map(pref => ({ ...pref, includeSavings: checked }))
    );
  };

  const toggleAllChecking = (checked: boolean) => {
    setAccountPreferences(prev => 
      prev.map(pref => ({ ...pref, includeChecking: checked }))
    );
  };

  // Calculer l'état des cases à cocher globales
  const allSavingsChecked = accountPreferences.length > 0 && accountPreferences.every(pref => pref.includeSavings);
  const allCheckingChecked = accountPreferences.length > 0 && accountPreferences.every(pref => pref.includeChecking);
  const someSavingsChecked = accountPreferences.some(pref => pref.includeSavings);
  const someCheckingChecked = accountPreferences.some(pref => pref.includeChecking);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Sauvegarder dans la base de données via l'API
  const response = await apiFetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'dropbox_url',
          value: editUrl
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      // Mettre à jour l'état local
      onUpdateDropboxUrl(editUrl);
      setIsEditing(false);
      toast.success("URL Dropbox mise à jour avec succès !");
    } catch (error) {
      console.error('Failed to save dropbox URL:', error);
      toast.error('Échec de la sauvegarde de l\'URL Dropbox');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditUrl(dropboxUrl);
    setIsEditing(false);
  };

  const handleUpdateAccounts = async () => {
    setIsUpdatingAccounts(true);
    try {
      const success = await updateAccounts({
        requireDropboxUrl: true,
        dropboxUrl: dropboxUrl
      });
    } finally {
      setIsUpdatingAccounts(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground">
            Configurez les paramètres de l'application
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Intégration Dropbox</CardTitle>
          <CardDescription>
            Configurez l'URL de votre dossier Dropbox pour la synchronisation des données
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dropbox-url">URL Dropbox</Label>
            <div className="flex gap-2">
              <Input
                id="dropbox-url"
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://dropbox.com/..."
                disabled={!isEditing}
                className={isEditing ? "" : "bg-muted"}
              />
              {!isEditing ? (
                <Button 
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                >
                  Modifier
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSave} 
                    size="sm" 
                    disabled={isLoading}
                    style={{ 
                      backgroundColor: '#059669', 
                      borderColor: '#059669',
                      color: 'white'
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.backgroundColor = '#047857';
                        e.currentTarget.style.borderColor = '#047857';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.backgroundColor = '#059669';
                        e.currentTarget.style.borderColor = '#059669';
                      }
                    }}
                    variant="default"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Button>
                  <Button onClick={handleCancel}  variant="outline"  size="sm" >
                    Annuler
                  </Button>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Cette URL sera utilisée pour synchroniser vos données de budget avec votre compte Dropbox.
            </p>
          </div>

          {dropboxUrl && !isEditing && (
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Dropbox configuré</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                URL: {dropboxUrl}
              </p>
            </div>
          )}

          {!dropboxUrl && !isEditing && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">Dropbox non configuré</span>
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                Cliquez sur "Modifier" pour configurer votre URL Dropbox.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mise à jour des comptes</CardTitle>
          <CardDescription>
            Téléchargez et mettez à jour le fichier de comptes depuis Dropbox
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Comment ça fonctionne
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• L'application télécharge le fichier ZIP depuis votre Dropbox</li>
                  <li>• Le fichier est automatiquement décompressé</li>
                  <li>• Le fichier .cdb est extrait et remplace Comptes.cdb</li>
                  <li>• Une sauvegarde de l'ancien fichier est créée</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={handleUpdateAccounts}
              disabled={!dropboxUrl || isUpdatingAccounts}
              size="default"
              style={{ 
                backgroundColor: dropboxUrl && !isUpdatingAccounts ? '#2563eb' : undefined, 
                borderColor: dropboxUrl && !isUpdatingAccounts ? '#2563eb' : undefined,
                color: dropboxUrl && !isUpdatingAccounts ? 'white' : undefined
              }}
              onMouseEnter={(e) => {
                if (dropboxUrl && !isUpdatingAccounts) {
                  e.currentTarget.style.backgroundColor = '#1d4ed8';
                  e.currentTarget.style.borderColor = '#1d4ed8';
                }
              }}
              onMouseLeave={(e) => {
                if (dropboxUrl && !isUpdatingAccounts) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.borderColor = '#2563eb';
                }
              }}
            >
              {isUpdatingAccounts ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Mise à jour en cours...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Mettre à jour les comptes
                </>
              )}
            </Button>
          </div>

          {!dropboxUrl && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">URL Dropbox requise</span>
              </div>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                Veuillez d'abord configurer votre URL Dropbox pour utiliser cette fonctionnalité.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gestion des comptes
          </CardTitle>
          <CardDescription>
            Configurez quels comptes inclure dans les calculs d'épargne et de dépenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {accountPreferences.length} compte(s) configuré(s)
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={refreshAccountList}
                  disabled={isRefreshingAccounts}
                  variant="outline"
                  size="sm"
                >
                  {isRefreshingAccounts ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Actualisation...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Actualiser la liste
                    </>
                  )}
                </Button>
                <Button 
                  onClick={saveAllPreferences}
                  disabled={isSavingPreferences || accountPreferences.length === 0}
                  variant="default"
                  size="sm"
                >
                  {isSavingPreferences ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Sauvegarder
                    </>
                  )}
                </Button>
              </div>
            </div>

            {isLoadingPreferences ? (
              <div className="text-center py-4">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Chargement des comptes...</p>
              </div>
            ) : accountPreferences.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Aucun compte configuré. Cliquez sur "Actualiser la liste" pour charger les comptes.
                </p>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border rounded-md">
                <table className="w-full">
                  {/* Header row */}
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">Nom du compte</th>
                      <th className="text-center p-3 font-medium text-sm border-l w-32">
                        <div className="flex flex-col items-center gap-1">
                          <span>Inclure dans l'épargne</span>
                          <Checkbox
                            id="toggle-all-savings"
                            checked={allSavingsChecked}
                            onCheckedChange={(checked) => toggleAllSavings(!!checked)}
                            className="h-3 w-3"
                            title={allSavingsChecked ? "Désélectionner tout" : "Sélectionner tout"}
                          />
                        </div>
                      </th>
                      <th className="text-center p-3 font-medium text-sm border-l w-32">
                        <div className="flex flex-col items-center gap-1">
                          <span>Inclure dans les dépenses</span>
                          <Checkbox
                            id="toggle-all-checking"
                            checked={allCheckingChecked}
                            onCheckedChange={(checked) => toggleAllChecking(!!checked)}
                            className="h-3 w-3"
                            title={allCheckingChecked ? "Désélectionner tout" : "Sélectionner tout"}
                          />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {accountPreferences.map((pref, index) => (
                      <tr 
                        key={pref.accountId}
                        className={`${index !== accountPreferences.length - 1 ? 'border-b' : ''} hover:bg-muted/20`}
                      >
                        <td className="p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {pref.accountName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ID: {pref.accountId}
                            </p>
                          </div>
                        </td>
                        <td className="p-3 text-center border-l">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              id={`savings-${pref.accountId}`}
                              checked={pref.includeSavings}
                              onCheckedChange={(checked) => 
                                updateAccountPreference(pref.accountId, pref.accountName, 'includeSavings', !!checked)
                              }
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center border-l">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              id={`checking-${pref.accountId}`}
                              checked={pref.includeChecking}
                              onCheckedChange={(checked) => 
                                updateAccountPreference(pref.accountId, pref.accountName, 'includeChecking', !!checked)
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Settings className="h-4 w-4" />
                <span className="text-sm font-medium">Information</span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Cochez les cases pour inclure les comptes dans les calculs d'épargne mensuelle et de dépenses. 
                Cliquez sur "Actualiser la liste" après avoir ajouté de nouveaux comptes dans votre base de données.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>À propos</CardTitle>
          <CardDescription>
            Informations sur l'application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version:</span>
              <span><VersionInfo className="opacity-70" /></span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dernière mise à jour:</span>
              <span>Août 2025</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}