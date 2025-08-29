import { useState } from "react";
import { Project } from "../types/budget";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Calendar, Target, Clock } from "lucide-react";

interface CreateProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Omit<Project, 'id' | 'currentSavings' | 'currentSpent'>) => void;
}

export function CreateProjectForm({ isOpen, onClose, onCreateProject }: CreateProjectFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    plannedBudget: '',
    description: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom du projet est requis';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'La date de début est requise';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'La date de fin est requise';
    }

    if (formData.startDate && formData.endDate && new Date(formData.startDate) >= new Date(formData.endDate)) {
      newErrors.endDate = 'La date de fin doit être après la date de début';
    }

    if (!formData.plannedBudget.trim()) {
      newErrors.plannedBudget = 'Le budget prévu est requis';
    } else {
      const budget = parseFloat(formData.plannedBudget);
      if (isNaN(budget) || budget <= 0) {
        newErrors.plannedBudget = 'Le budget doit être un nombre positif';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const projectData: Omit<Project, 'id' | 'currentSavings' | 'currentSpent'> = {
      name: formData.name.trim(),
      startDate: formData.startDate,
      endDate: formData.endDate,
      plannedBudget: parseFloat(formData.plannedBudget)
    };

    onCreateProject(projectData);
    
    // Reset form
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      plannedBudget: '',
      description: ''
    });
    setErrors({});
    onClose();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      startDate: '',
      endDate: '',
      plannedBudget: '',
      description: ''
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
  <DialogContent className="w-full max-w-sm sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Créer un nouveau projet</DialogTitle>
          <DialogDescription>
            Définissez les paramètres de votre nouveau projet budgétaire.
          </DialogDescription>
        </DialogHeader>

  <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du projet *</Label>
            <Input
              id="name"
              placeholder="ex: Voyage au Japon, Nouvelle voiture..."
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date de début *
              </Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className={errors.startDate ? 'border-destructive' : ''}
              />
              {errors.startDate && <p className="text-sm text-destructive">{errors.startDate}</p>}
            </div>

            <div className="space-y-4">
              <Label htmlFor="endDate" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Date de fin *
              </Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                className={errors.endDate ? 'border-destructive' : ''}
              />
              {errors.endDate && <p className="text-sm text-destructive">{errors.endDate}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="plannedBudget" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Budget prévu (€) *
            </Label>
            <Input
              id="plannedBudget"
              type="number"
              placeholder="5000"
              min="0"
              step="0.01"
              value={formData.plannedBudget}
              onChange={(e) => handleInputChange('plannedBudget', e.target.value)}
              className={errors.plannedBudget ? 'border-destructive' : ''}
            />
            {errors.plannedBudget && <p className="text-sm text-destructive">{errors.plannedBudget}</p>}
          </div>

          <div className="space-y-4">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea
              id="description"
              placeholder="Décrivez votre projet..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit">
              Créer le projet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}