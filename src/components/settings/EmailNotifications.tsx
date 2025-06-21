"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, Loader2 } from 'lucide-react';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface EmailNotificationsProps {
  initialEmails?: string[];
  initialEnabled?: boolean;
}

export default function EmailNotifications({ 
  initialEmails = [], 
  initialEnabled = false 
}: EmailNotificationsProps) {
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [newEmail, setNewEmail] = useState('');
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleAddEmail = () => {
    if (!newEmail) return;
    
    // Простая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        variant: 'destructive',
        title: 'Неверный формат',
        description: 'Пожалуйста, введите корректный email адрес.'
      });
      return;
    }
    
    if (emails.includes(newEmail)) {
      toast({
        variant: 'destructive',
        title: 'Дубликат',
        description: 'Этот email уже добавлен в список.'
      });
      return;
    }
    
    setEmails([...emails, newEmail]);
    setNewEmail('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const notificationsRef = doc(db, 'notifications', 'email_config');
      const docSnap = await getDoc(notificationsRef);
      
      if (docSnap.exists()) {
        await updateDoc(notificationsRef, {
          emails,
          enabled: isEnabled,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(notificationsRef, {
          emails,
          enabled: isEnabled,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      toast({
        title: 'Настройки сохранены',
        description: 'Настройки уведомлений по email успешно обновлены.'
      });
    } catch (error) {
      console.error('Error saving email notification settings:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки уведомлений.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Уведомления по Email
        </CardTitle>
        <CardDescription>
          Настройте email-уведомления о новых обнаруженных утечках API ключей.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch 
            id="notifications-enabled" 
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
          <Label htmlFor="notifications-enabled">
            {isEnabled ? 'Уведомления включены' : 'Уведомления отключены'}
          </Label>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Добавить email для уведомлений</Label>
          <div className="flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="example@company.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddEmail} type="button">
              Добавить
            </Button>
          </div>
        </div>
        
        {emails.length > 0 && (
          <div className="space-y-2">
            <Label>Список email-адресов для уведомлений</Label>
            <div className="space-y-2">
              {emails.map((email, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{email}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleRemoveEmail(email)}
                  >
                    Удалить
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-sm text-muted-foreground">
          Уведомления будут отправляться при обнаружении новых утечек API ключей.
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSaveSettings} 
          disabled={isSaving}
          className="w-full sm:w-auto"
        >
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
          Сохранить настройки уведомлений
        </Button>
      </CardFooter>
    </Card>
  );
}
