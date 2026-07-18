import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Bot, Loader2, Pencil, Plus, Send, X } from "lucide-react";
import { Message, MessageBubble } from "./MessageBubble";
import { apiFetch } from "../../utils/apiClient";
import { toast } from "sonner";
import { cn } from "../ui/utils";

const MAX_CONVERSATIONS = 10;
const WELCOME_MESSAGE: Message = {
    id: 'welcome',
    role: 'assistant',
    content: 'Bonjour ! Je suis votre assistant financier. Posez-moi des questions sur vos dépenses, vos revenus ou votre budget.',
    timestamp: new Date(),
};

interface Conversation {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Message[];
}

function hydrateConversation(raw: any): Conversation {
    return {
        ...raw,
        messages: (raw.messages || []).map((message: any) => ({
            ...message,
            timestamp: new Date(message.timestamp),
        })),
    };
}

export function ChatInterface() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [isInitializing, setIsInitializing] = useState(true);
    const initializedRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const activeConversation = useMemo(
        () => conversations.find(conversation => conversation.id === activeId) || null,
        [conversations, activeId],
    );
    const activeMessages = activeConversation?.messages || [];
    const activeDraft = activeId ? drafts[activeId] || '' : '';
    const isActiveLoading = activeId ? pendingIds.has(activeId) : false;

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const initialize = async () => {
            try {
                const response = await apiFetch('/api/assistant/conversations');
                if (!response.ok) throw new Error('Impossible de charger les discussions');
                let loaded = (await response.json()).map(hydrateConversation);

                if (loaded.length === 0) {
                    const createResponse = await apiFetch('/api/assistant/conversations', {
                        method: 'POST',
                        body: JSON.stringify({ title: 'Nouvelle discussion' }),
                    });
                    if (!createResponse.ok) throw new Error('Impossible de créer une discussion');
                    loaded = [hydrateConversation(await createResponse.json())];
                }

                setConversations(loaded);
                setActiveId(loaded[0]?.id || null);
            } catch (error) {
                console.error(error);
                toast.error("Impossible de restaurer l'historique de l'assistant.");
            } finally {
                setIsInitializing(false);
            }
        };

        initialize();
    }, []);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeId, activeMessages.length, isActiveLoading]);

    const updateConversation = (conversationId: string, updater: (conversation: Conversation) => Conversation) => {
        setConversations(current => current.map(conversation =>
            conversation.id === conversationId ? updater(conversation) : conversation
        ));
    };

    const createConversation = async () => {
        if (conversations.length >= MAX_CONVERSATIONS) {
            toast.error('Vous pouvez ouvrir au maximum 10 discussions.');
            return;
        }
        try {
            const response = await apiFetch('/api/assistant/conversations', {
                method: 'POST',
                body: JSON.stringify({ title: `Discussion ${conversations.length + 1}` }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || 'Création impossible');
            }
            const conversation = hydrateConversation(await response.json());
            setConversations(current => [...current, conversation]);
            setActiveId(conversation.id);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Création impossible');
        }
    };

    const startRenaming = (conversation: Conversation) => {
        setEditingId(conversation.id);
        setEditingTitle(conversation.title);
    };

    const saveTitle = async (conversationId: string) => {
        const title = editingTitle.trim();
        setEditingId(null);
        if (!title) return;

        const previousTitle = conversations.find(item => item.id === conversationId)?.title;
        updateConversation(conversationId, conversation => ({ ...conversation, title }));
        try {
            const response = await apiFetch(`/api/assistant/conversations/${conversationId}`, {
                method: 'PATCH',
                body: JSON.stringify({ title }),
            });
            if (!response.ok) throw new Error('Renommage impossible');
        } catch (error) {
            if (previousTitle) {
                updateConversation(conversationId, conversation => ({ ...conversation, title: previousTitle }));
            }
            toast.error('Impossible de renommer cette discussion.');
        }
    };

    const closeConversation = async (conversation: Conversation) => {
        if (pendingIds.has(conversation.id)) return;
        if (conversation.messages.length > 0 && !window.confirm(`Fermer « ${conversation.title} » et supprimer son historique ?`)) return;

        try {
            const response = await apiFetch(`/api/assistant/conversations/${conversation.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Suppression impossible');
            const remaining = conversations.filter(item => item.id !== conversation.id);
            setConversations(remaining);
            setDrafts(current => {
                const next = { ...current };
                delete next[conversation.id];
                return next;
            });
            if (activeId === conversation.id) setActiveId(remaining[0]?.id || null);
        } catch (error) {
            toast.error('Impossible de fermer cette discussion.');
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!activeId || !activeDraft.trim() || pendingIds.has(activeId)) return;

        const conversationId = activeId;
        const content = activeDraft.trim();
        const userMessage: Message = {
            id: `pending-${Date.now()}`,
            role: 'user',
            content,
            timestamp: new Date(),
        };

        updateConversation(conversationId, conversation => ({
            ...conversation,
            messages: [...conversation.messages, userMessage],
        }));
        setDrafts(current => ({ ...current, [conversationId]: '' }));
        setPendingIds(current => new Set(current).add(conversationId));

        try {
            const response = await apiFetch('/api/assistant/chat', {
                method: 'POST',
                body: JSON.stringify({ conversationId, message: content }),
            });
            if (!response.ok) throw new Error('Réponse impossible');
            const payload = await response.json();
            const assistantMessage: Message = payload.message ? {
                ...payload.message,
                timestamp: new Date(payload.message.timestamp),
            } : {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: payload.text,
                type: payload.type,
                chartType: payload.chartType,
                data: payload.data,
                timestamp: new Date(),
            };
            updateConversation(conversationId, conversation => ({
                ...conversation,
                messages: [...conversation.messages, assistantMessage],
            }));
        } catch (error) {
            console.error('Chat error:', error);
            toast.error("Désolé, je n'ai pas pu traiter votre demande.");
            updateConversation(conversationId, conversation => ({
                ...conversation,
                messages: [...conversation.messages, {
                    id: `error-${Date.now()}`,
                    role: 'assistant',
                    content: "Désolé, une erreur est survenue lors du traitement de votre demande. Veuillez réessayer.",
                    timestamp: new Date(),
                }],
            }));
        } finally {
            setPendingIds(current => {
                const next = new Set(current);
                next.delete(conversationId);
                return next;
            });
        }
    };

    if (isInitializing) {
        return <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Restauration des discussions…</div>;
    }

    return (
        <div className="flex h-full max-h-[calc(100vh-10rem)] flex-col">
            <div className="mb-3 flex items-center gap-2 overflow-x-auto border-b pb-2" role="tablist" aria-label="Discussions de l'assistant">
                {conversations.map(conversation => {
                    const isActive = conversation.id === activeId;
                    const isPending = pendingIds.has(conversation.id);
                    return (
                        <div
                            key={conversation.id}
                            className={cn(
                                "group flex h-9 max-w-56 shrink-0 items-center gap-1 rounded-t-md border px-2 text-sm",
                                isActive ? "border-b-background bg-background font-medium shadow-sm" : "bg-muted/60 text-muted-foreground",
                            )}
                        >
                            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {editingId === conversation.id ? (
                                <Input
                                    autoFocus
                                    value={editingTitle}
                                    maxLength={80}
                                    onChange={event => setEditingTitle(event.target.value)}
                                    onBlur={() => saveTitle(conversation.id)}
                                    onKeyDown={event => {
                                        if (event.key === 'Enter') event.currentTarget.blur();
                                        if (event.key === 'Escape') setEditingId(null);
                                    }}
                                    className="h-7 w-36 px-1"
                                />
                            ) : (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => setActiveId(conversation.id)}
                                    onDoubleClick={() => startRenaming(conversation)}
                                    className="min-w-0 flex-1 truncate text-left"
                                    title={conversation.title}
                                >
                                    {conversation.title}
                                </button>
                            )}
                            <button type="button" onClick={() => startRenaming(conversation)} className="rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100 focus:opacity-100" title="Renommer">
                                <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" disabled={isPending} onClick={() => closeConversation(conversation)} className="rounded p-0.5 opacity-60 hover:bg-muted hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-20" title={isPending ? 'Réponse en cours' : 'Fermer'}>
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    );
                })}
                <Button type="button" variant="outline" size="sm" onClick={createConversation} disabled={conversations.length >= MAX_CONVERSATIONS} title={conversations.length >= MAX_CONVERSATIONS ? 'Maximum de 10 discussions atteint' : 'Nouvelle discussion'} className="shrink-0">
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Nouvelle discussion</span>
                </Button>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{conversations.length}/{MAX_CONVERSATIONS}</span>
            </div>

            {activeConversation ? (
                <>
                    <ScrollArea className="mb-4 flex-1 rounded-md border bg-background p-4 shadow-sm">
                        <div className="space-y-4">
                            {(activeMessages.length ? activeMessages : [WELCOME_MESSAGE]).map(message => (
                                <MessageBubble key={message.id} message={message} />
                            ))}
                            {isActiveLoading && (
                                <div className="mb-4 flex justify-start">
                                    <div className="flex items-center gap-2 rounded-lg bg-muted p-4">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Je réfléchis…</span>
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>

                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input
                            value={activeDraft}
                            onChange={event => setDrafts(current => ({ ...current, [activeConversation.id]: event.target.value }))}
                            placeholder="Posez votre question…"
                            disabled={isActiveLoading}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={isActiveLoading || !activeDraft.trim()}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-md border border-dashed text-center text-muted-foreground">
                    <Bot className="h-10 w-10" />
                    <p>Toutes les discussions sont fermées.</p>
                    <Button type="button" onClick={createConversation}><Plus className="mr-2 h-4 w-4" />Nouvelle discussion</Button>
                </div>
            )}
        </div>
    );
}
