import React, { useState, useRef, useEffect } from 'react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Send, Bot, Loader2 } from "lucide-react";
import { Message, MessageBubble } from "./MessageBubble";
import { apiFetch } from "../../utils/apiClient";
import { toast } from "sonner";

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: 'Bonjour ! Je suis votre assistant financier. Posez-moi des questions sur vos dépenses, vos revenus ou votre budget.',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await apiFetch('/api/assistant/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage.content })
            });

            if (!res.ok) {
                throw new Error('Failed to get response');
            }

            const data = await res.json();

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.text,
                type: data.type,
                chartType: data.chartType,
                data: data.data,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            toast.error("Désolé, je n'ai pas pu traiter votre demande.");
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Désolé, une erreur est survenue lors du traitement de votre demande. Veuillez réessayer.",
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full max-h-[calc(100vh-10rem)]">
            <ScrollArea className="flex-1 p-4 border rounded-md mb-4 bg-background shadow-sm">
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <MessageBubble key={msg.id} message={msg} />
                    ))}
                    {isLoading && (
                        <div className="flex justify-start mb-4">
                            <div className="bg-muted rounded-lg p-4 flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Je réfléchis...</span>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Posez votre question..."
                    disabled={isLoading}
                    className="flex-1"
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                    <Send className="h-4 w-4" />
                </Button>
            </form>
        </div>
    );
}
