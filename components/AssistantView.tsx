import React from 'react';
import { ChatInterface } from "./assistant/ChatInterface";
import { Bot } from "lucide-react";

export function AssistantView() {
    return (
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Bot className="h-6 w-6" />
                        Assistant IA
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Posez des questions en langage naturel sur vos finances.
                    </p>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ChatInterface />
            </div>
        </div>
    );
}
