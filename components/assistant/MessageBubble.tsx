import React from 'react';
import { Card, CardContent } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { cn } from "../ui/utils";

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type?: 'text' | 'table' | 'chart';
    chartType?: 'bar' | 'line' | 'pie';
    data?: any[];
    timestamp: Date;
}

interface MessageBubbleProps {
    message: Message;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

function normalizeMarkdownLayout(content: string) {
    return content
        .replace(/\r\n?/g, '\n')
        .replace(/\s+(?=\*\*[^*]+:\*\*\s+-\s+)/g, '\n\n')
        .replace(/:\s+(?=-\s+\*\*)/g, ':\n')
        .replace(/\s+-\s+(?=\*\*[^*]+\*\*\s*:)/g, '\n- ')
        .replace(/(\*\*)\s+(?=(?:Le|La|Ce|Cette)\s+(?:graphique|courbe|diagramme)\b)/g, '$1\n\n');
}

function renderInlineMarkdown(content: string) {
    return content.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
        part.startsWith('**') && part.endsWith('**')
            ? <strong key={index}>{part.slice(2, -2)}</strong>
            : <React.Fragment key={index}>{part}</React.Fragment>
    );
}

function MarkdownText({ content }: { content: string }) {
    const lines = normalizeMarkdownLayout(content).split('\n');
    const blocks: React.ReactNode[] = [];

    for (let index = 0; index < lines.length;) {
        const line = lines[index].trim();
        if (!line) {
            index += 1;
            continue;
        }

        if (/^-\s+/.test(line)) {
            const items: string[] = [];
            while (index < lines.length && /^-\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^-\s+/, ''));
                index += 1;
            }
            blocks.push(
                <ul key={`list-${index}`} className="my-2 list-disc space-y-1 pl-5">
                    {items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
                </ul>
            );
            continue;
        }

        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            blocks.push(
                <div key={`heading-${index}`} className="mb-1 mt-3 font-semibold">
                    {renderInlineMarkdown(heading[2])}
                </div>
            );
        } else {
            blocks.push(
                <p key={`paragraph-${index}`} className="my-1 whitespace-pre-wrap">
                    {renderInlineMarkdown(line)}
                </p>
            );
        }
        index += 1;
    }

    return <div>{blocks}</div>;
}

function numericValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;

    const normalized = value.trim().replace(/\s/g, '').replace(/€/g, '').replace(',', '.');
    if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';

    const renderContent = () => {
        if (message.type === 'table' && message.data && message.data.length > 0) {
            const columns = Object.keys(message.data[0]);
            return (
                <div className="mt-2 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHead key={col}>{col}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {message.data.map((row, i) => (
                                <TableRow key={i}>
                                    {columns.map((col) => (
                                        <TableCell key={col}>{row[col]}</TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            );
        }

        const shouldRenderChart = (message.type === 'chart' || Boolean(message.chartType))
            && message.data && message.data.length > 0;

        if (shouldRenderChart) {
            // Determine keys for chart
            const keys = Object.keys(message.data[0]);
            const nameKey = keys.find(k => /(name|nom|date|category|cat[ée]gorie|month|mois|label|libell[ée])/i.test(k)) || keys[0];
            const valueKeys = keys.filter(k => k !== nameKey && message.data!.some(row => numericValue(row[k]) !== null));
            if (valueKeys.length === 0) return null;

            const chartData = message.data.map(row => ({
                ...row,
                ...Object.fromEntries(valueKeys.map(key => [key, numericValue(row[key])])),
            }));
            const chartType = message.chartType || 'bar';

            return (
                <div className="h-[300px] w-full mt-4 min-w-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'line' ? (
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey={nameKey} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {valueKeys.map((key, index) => (
                                    <Line key={key} type="monotone" dataKey={key} stroke={COLORS[index % COLORS.length]} />
                                ))}
                            </LineChart>
                        ) : chartType === 'pie' ? (
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey={valueKeys[0]}
                                    nameKey={nameKey}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        ) : (
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey={nameKey} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {valueKeys.map((key, index) => (
                                    <Bar key={key} dataKey={key} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div >
            );
        }

        return null;
    };

    return (
        <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[80%] rounded-lg p-4", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
                {isUser
                    ? <p className="whitespace-pre-wrap">{message.content}</p>
                    : <MarkdownText content={message.content} />}
                {renderContent()}
                <div className="text-xs opacity-50 mt-1 text-right">
                    {message.timestamp.toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
}
