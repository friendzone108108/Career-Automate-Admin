'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
    Briefcase,
    Play,
    Loader2,
    Clock,
    CheckCircle2,
    XCircle,
    RefreshCw,
    MapPin,
    Building2,
    Hash,
    Calendar
} from 'lucide-react';

const JOB_FETCHER_API_URL = process.env.NEXT_PUBLIC_JOB_FETCHER_API_URL || 'https://us91gapn47.execute-api.ap-south-1.amazonaws.com/Prod/v1';

// Published At options for time filter
const PUBLISHED_AT_OPTIONS = [
    { value: '', label: 'Any Time' },
    { value: 'r86400', label: 'Past 24 Hours' },
    { value: 'r604800', label: 'Past Week' },
    { value: 'r2592000', label: 'Past Month' },
];

// Common job titles
const COMMON_JOB_TITLES = [
    'Software Engineer',
    'Full Stack Developer',
    'Backend Developer',
    'Frontend Developer',
    'Data Scientist',
    'Data Analyst',
    'Product Manager',
    'DevOps Engineer',
    'Machine Learning Engineer',
    'UI/UX Designer',
];

// Common locations
const COMMON_LOCATIONS = [
    'United States',
    'India',
    'Remote',
    'United Kingdom',
    'Germany',
    'Canada',
    'Singapore',
    'Australia',
];

interface FetchRun {
    id: string;
    portal: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    jobs_found: number;
    new_jobs_added: number;
}

export default function JobFetcherPage() {
    const { session } = useAuth();

    // Form state
    const [title, setTitle] = useState('Software Engineer');
    const [location, setLocation] = useState('India');
    const [rows, setRows] = useState(50);
    const [companyNames, setCompanyNames] = useState('');
    const [publishedAt, setPublishedAt] = useState('');

    // UI state
    const [fetching, setFetching] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [fetchRuns, setFetchRuns] = useState<FetchRun[]>([]);
    const [lastRunResult, setLastRunResult] = useState<{ run_id: string; status: string; message: string } | null>(null);

    useEffect(() => {
        loadFetchHistory();
    }, []);

    const loadFetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const response = await fetch(`${JOB_FETCHER_API_URL}/job-fetcher/runs?page=1&page_size=10`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setFetchRuns(data.runs || []);
            }
        } catch (error) {
            console.error('Error loading fetch history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleStartFetch = async () => {
        if (!title.trim()) {
            toast.error('Please enter a job title');
            return;
        }
        if (!location.trim()) {
            toast.error('Please enter a location');
            return;
        }
        if (rows < 1 || rows > 200) {
            toast.error('Number of jobs must be between 1 and 200');
            return;
        }

        setFetching(true);
        setLastRunResult(null);

        try {
            const requestBody: any = {
                title: title.trim(),
                location: location.trim(),
                rows: rows
            };

            // Add optional fields
            if (companyNames.trim()) {
                requestBody.companyName = companyNames.split(',').map(c => c.trim()).filter(c => c);
            }
            if (publishedAt) {
                requestBody.publishedAt = publishedAt;
            }

            const response = await fetch(`${JOB_FETCHER_API_URL}/job-fetcher/sync`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.message || 'Failed to start job fetch');
            }

            setLastRunResult(data);
            toast.success('Job fetch started successfully!');

            // Reload history after a short delay
            setTimeout(() => {
                loadFetchHistory();
            }, 2000);

        } catch (error: any) {
            console.error('Error starting job fetch:', error);
            toast.error(error.message || 'Failed to start job fetch');
        } finally {
            setFetching(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>;
            case 'started':
            case 'running':
                return <Badge variant="warning" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Running</Badge>;
            case 'failed':
                return <Badge variant="danger" className="gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <AdminLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Briefcase className="w-6 h-6 text-blue-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Job Fetcher</h1>
                    </div>
                    <p className="text-gray-500">
                        Fetch jobs from LinkedIn using the Apify scraper. Configure your search criteria and trigger job fetching.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Form */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Play className="w-5 h-5 text-blue-600" />
                                    Start New Job Fetch
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Job Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Briefcase className="w-4 h-4 inline mr-1" />
                                        Job Title <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g., Software Engineer"
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {COMMON_JOB_TITLES.slice(0, 5).map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setTitle(t)}
                                                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Location */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <MapPin className="w-4 h-4 inline mr-1" />
                                        Location <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder="e.g., India, United States, Remote"
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {COMMON_LOCATIONS.map((loc) => (
                                            <button
                                                key={loc}
                                                type="button"
                                                onClick={() => setLocation(loc)}
                                                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                                            >
                                                {loc}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Number of Jobs */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Hash className="w-4 h-4 inline mr-1" />
                                        Number of Jobs to Fetch <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="number"
                                        value={rows}
                                        onChange={(e) => setRows(parseInt(e.target.value) || 50)}
                                        min={1}
                                        max={200}
                                        placeholder="50"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Min: 1, Max: 200. More jobs = more Apify credits consumed.
                                    </p>
                                </div>

                                {/* Company Names (Optional) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Building2 className="w-4 h-4 inline mr-1" />
                                        Company Names <span className="text-gray-400">(Optional)</span>
                                    </label>
                                    <Input
                                        value={companyNames}
                                        onChange={(e) => setCompanyNames(e.target.value)}
                                        placeholder="Google, Microsoft, Amazon (comma separated)"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Leave empty to search all companies. Separate multiple names with commas.
                                    </p>
                                </div>

                                {/* Published At Filter (Optional) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Calendar className="w-4 h-4 inline mr-1" />
                                        Posted Within <span className="text-gray-400">(Optional)</span>
                                    </label>
                                    <select
                                        value={publishedAt}
                                        onChange={(e) => setPublishedAt(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {PUBLISHED_AT_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Submit Button */}
                                <div className="pt-4 border-t">
                                    <Button
                                        onClick={handleStartFetch}
                                        disabled={fetching || !title.trim() || !location.trim()}
                                        className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                    >
                                        {fetching ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Starting Job Fetch...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-5 h-5 mr-2" />
                                                Start Job Fetch
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-xs text-center text-gray-500 mt-2">
                                        ⚠️ This will consume Apify credits. Use responsibly.
                                    </p>
                                </div>

                                {/* Last Run Result */}
                                {lastRunResult && (
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                            <span className="font-medium text-green-800">Job Fetch Started!</span>
                                        </div>
                                        <p className="text-sm text-green-700">{lastRunResult.message}</p>
                                        <p className="text-xs text-green-600 mt-1">Run ID: {lastRunResult.run_id}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column - History */}
                    <div>
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-gray-600" />
                                        Recent Runs
                                    </CardTitle>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={loadFetchHistory}
                                        disabled={loadingHistory}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loadingHistory ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                    </div>
                                ) : fetchRuns.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p>No fetch runs yet</p>
                                        <p className="text-xs">Start your first job fetch above!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {fetchRuns.map((run) => (
                                            <div
                                                key={run.id}
                                                className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    {getStatusBadge(run.status)}
                                                    <span className="text-xs text-gray-500">
                                                        {run.portal}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-600 space-y-1">
                                                    <p>Started: {formatDate(run.started_at)}</p>
                                                    {run.finished_at && (
                                                        <p>Finished: {formatDate(run.finished_at)}</p>
                                                    )}
                                                    <div className="flex gap-4 mt-2 pt-2 border-t border-gray-200">
                                                        <span>
                                                            <strong>{run.jobs_found}</strong> found
                                                        </span>
                                                        <span className="text-green-600">
                                                            <strong>{run.new_jobs_added}</strong> new
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
