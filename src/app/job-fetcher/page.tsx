'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { createAdminServiceClient } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    Briefcase,
    Play,
    Loader2,
    CheckCircle2,
    MapPin,
    Hash,
    Calendar,
    Globe,
    AlertTriangle
} from 'lucide-react';

const JOB_FETCHER_API_URL = process.env.NEXT_PUBLIC_JOB_FETCHER_API_URL || 'https://us91gapn47.execute-api.ap-south-1.amazonaws.com/Prod/v1';

// Cutoff date - only show runs started after this date
const RUNS_CUTOFF_DATE = new Date('2026-01-26T00:00:00Z');

// Published At options for time filter
const PUBLISHED_AT_OPTIONS = [
    { value: '', label: 'Any Time' },
    { value: 'r86400', label: 'Past 24 Hours' },
    { value: 'r604800', label: 'Past Week' },
    { value: 'r2592000', label: 'Past Month' },
];

// Country options for Indeed
const COUNTRY_OPTIONS = [
    { value: 'IN', label: 'India' },
    { value: 'US', label: 'United States' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'DE', label: 'Germany' },
    { value: 'CA', label: 'Canada' },
    { value: 'SG', label: 'Singapore' },
    { value: 'AU', label: 'Australia' },
];

// Common job titles
const COMMON_JOB_TITLES = [
    'Software Engineer',
    'Full Stack Developer',
    'Backend Developer',
    'Frontend Developer',
    'Data Scientist',
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
    const [country, setCountry] = useState('IN');
    const [publishedAt, setPublishedAt] = useState('');

    // UI state
    const [fetching, setFetching] = useState(false);
    const [fetchRuns, setFetchRuns] = useState<FetchRun[]>([]);
    const [lastRunResult, setLastRunResult] = useState<{ run_id: string; status: string; message: string } | null>(null);
    const [automationsStopped, setAutomationsStopped] = useState(false);

    // Filter runs to only show those started after Jan 26, 2026
    const recentRuns = fetchRuns.filter(run => {
        const runDate = new Date(run.started_at);
        return runDate >= RUNS_CUTOFF_DATE;
    });

    // Check if any RECENT job is currently running
    const isJobRunning = recentRuns.some(run => run.status === 'started' || run.status === 'running');

    useEffect(() => {
        checkRunningJobs();
        checkAutomationsStatus();
    }, []);

    // Check if automations are globally stopped
    const checkAutomationsStatus = async () => {
        try {
            const adminClient = createAdminServiceClient();
            const { data } = await adminClient
                .from('system_settings')
                .select('setting_value')
                .eq('setting_key', 'all_automations_stopped')
                .single();

            setAutomationsStopped(data?.setting_value === 'true');
        } catch (error) {
            console.error('Error checking automations status:', error);
        }
    };

    // Poll for status updates when a job is running
    useEffect(() => {
        if (isJobRunning) {
            const interval = setInterval(() => {
                checkRunningJobs();
            }, 5000); // Poll every 5 seconds
            return () => clearInterval(interval);
        }
    }, [isJobRunning]);

    const checkRunningJobs = async () => {
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
            console.error('Error checking running jobs:', error);
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
        if (rows < 1 || rows > 100) {
            toast.error('Number of jobs must be between 1 and 100');
            return;
        }

        setFetching(true);
        setLastRunResult(null);

        try {
            const requestBody: any = {
                title: title.trim(),
                location: location.trim(),
                rows: rows,
                country: country
            };

            // Add optional fields
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

            // Reload running status after a short delay
            setTimeout(() => {
                checkRunningJobs();
            }, 2000);

        } catch (error: any) {
            console.error('Error starting job fetch:', error);
            toast.error(error.message || 'Failed to start job fetch');
        } finally {
            setFetching(false);
        }
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
                        Fetch jobs from LinkedIn, Indeed & Naukri using Apify scrapers. Configure your search criteria and trigger job fetching.
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
                                        {COMMON_JOB_TITLES.map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setTitle(t)}
                                                className={`text-xs px-2 py-1 rounded transition-colors ${title === t
                                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                                    }`}
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
                                                className={`text-xs px-2 py-1 rounded transition-colors ${location === loc
                                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                                                    }`}
                                            >
                                                {loc}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Country (for Indeed) */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Globe className="w-4 h-4 inline mr-1" />
                                        Country <span className="text-gray-400">(for Indeed portal)</span>
                                    </label>
                                    <select
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {COUNTRY_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
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
                                        max={100}
                                        placeholder="50"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Min: 1, Max: 100 per portal. More jobs = more Apify credits consumed.
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

                                {/* Automations Stopped Warning */}
                                {automationsStopped && (
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-red-800">Automations Stopped</p>
                                            <p className="text-sm text-red-600">All automation processes are currently disabled by the control mechanism. Job fetching is blocked.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <div className="pt-4 border-t">
                                    <Button
                                        onClick={handleStartFetch}
                                        disabled={fetching || !title.trim() || !location.trim() || isJobRunning || automationsStopped}
                                        className={`w-full h-12 text-base ${automationsStopped
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                                    >
                                        {automationsStopped ? (
                                            <>
                                                <AlertTriangle className="w-5 h-5 mr-2" />
                                                Automations Stopped
                                            </>
                                        ) : fetching ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Starting Job Fetch...
                                            </>
                                        ) : isJobRunning ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Job Fetch in Progress...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-5 h-5 mr-2" />
                                                Start Job Fetch
                                            </>
                                        )}
                                    </Button>
                                    <p className="text-xs text-center text-gray-500 mt-2">
                                        ⚠️ This will consume Apify credits. Jobs are fetched from LinkedIn, Indeed & Naukri in parallel.
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

                    {/* Right Column - Running Indicator (Only show when actually running) */}
                    <div>
                        {isJobRunning && (
                            <Card className="border-orange-200 bg-orange-50">
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-orange-100 rounded-full">
                                            <Loader2 className="w-6 h-6 text-orange-600 animate-spin" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-orange-800">Job Fetch in Progress</h3>
                                            <p className="text-sm text-orange-600">
                                                A job fetch is currently running. Please wait for it to complete.
                                            </p>
                                        </div>
                                    </div>
                                    {/* Show recent running run details */}
                                    {recentRuns.filter(r => r.status === 'started' || r.status === 'running').map(run => (
                                        <div key={run.id} className="mt-4 p-3 bg-white rounded-lg border border-orange-200">
                                            <p className="text-xs text-gray-500">Run ID: {run.id.slice(0, 8)}...</p>
                                            <p className="text-xs text-gray-500">Portal: {run.portal}</p>
                                            <p className="text-xs text-gray-500">
                                                Started: {new Date(run.started_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Show recently completed runs */}
                        {!isJobRunning && recentRuns.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm text-gray-600">Recent Runs</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {recentRuns.slice(0, 3).map(run => (
                                        <div key={run.id} className={`p-3 rounded-lg border ${run.status === 'completed'
                                            ? 'bg-green-50 border-green-200'
                                            : run.status === 'failed'
                                                ? 'bg-red-50 border-red-200'
                                                : 'bg-gray-50 border-gray-200'
                                            }`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-medium text-gray-700">{run.portal}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${run.status === 'completed'
                                                    ? 'bg-green-100 text-green-700'
                                                    : run.status === 'failed'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {run.status}
                                                </span>
                                            </div>
                                            {run.status === 'completed' && (
                                                <p className="text-xs text-gray-600">
                                                    {run.jobs_found} found, {run.new_jobs_added} new
                                                </p>
                                            )}
                                            <p className="text-xs text-gray-400">
                                                {new Date(run.started_at).toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
