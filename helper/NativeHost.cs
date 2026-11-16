using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;

internal static class NativeHost
{
    private const int ChildTimeoutMilliseconds = 23000;

    private static int Main(string[] args)
    {
        Process child = null;
        try
        {
            // Chromium also appends --parent-window=<decimal> on Windows. The bridge
            // only receives the first argument (the browser origin) below.
            if (args == null || args.Length < 1 || String.IsNullOrEmpty(args[0]))
            {
                Console.Error.WriteLine("Otone native host requires the browser extension origin argument.");
                return 2;
            }

            string executableDirectory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string repositoryRoot = Path.GetFullPath(Path.Combine(executableDirectory, "..", ".."));
            string python = Path.Combine(repositoryRoot, "local-data", "runtime", "python.exe");
            string bridge = Path.Combine(repositoryRoot, "helper", "native_host.py");

            if (!File.Exists(python))
            {
                Console.Error.WriteLine("Otone native host cannot find local-data\\runtime\\python.exe. Run scripts/setup-helper.ps1 first.");
                return 3;
            }
            if (!File.Exists(bridge))
            {
                Console.Error.WriteLine("Otone native host cannot find helper\\native_host.py.");
                return 3;
            }

            ProcessStartInfo start = new ProcessStartInfo();
            start.FileName = python;
            start.Arguments = QuoteArgument(bridge) + " " + QuoteArgument(args[0]);
            start.WorkingDirectory = repositoryRoot;
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.RedirectStandardInput = true;
            start.RedirectStandardOutput = true;
            start.RedirectStandardError = true;

            child = Process.Start(start);
            if (child == null)
            {
                Console.Error.WriteLine("Otone native host could not start the local Python bridge.");
                return 4;
            }

            Stream nativeInput = Console.OpenStandardInput();
            Stream nativeOutput = Console.OpenStandardOutput();
            PumpInput(nativeInput, child.StandardInput.BaseStream);
            var firstOutput = new TaskCompletionSource<bool>();
            Task outputPump = PumpOutput(child.StandardOutput.BaseStream, nativeOutput, firstOutput);
            Task errorPump = DrainErrors(child.StandardError);

            if (!firstOutput.Task.Wait(ChildTimeoutMilliseconds))
            {
                try { child.Kill(); }
                catch { }
                Console.Error.WriteLine("Otone native bridge exceeded its 23 second response limit.");
                return 5;
            }
            child.WaitForExit();

            // Browser disconnect closes the input pipe. A rejected request may exit
            // while the browser still has its side open, so don't wait on the input pump.
            try { child.StandardInput.Close(); }
            catch { }
            try { Task.WaitAll(new Task[] { outputPump, errorPump }, 2000); }
            catch { }
            try { nativeOutput.Flush(); }
            catch { }
            return child.ExitCode;
        }
        catch (Exception error)
        {
            Console.Error.WriteLine("Otone native host failed: " + error.Message);
            return 1;
        }
        finally
        {
            if (child != null)
            {
                try
                {
                    if (!child.HasExited) child.Kill();
                }
                catch { }
                child.Dispose();
            }
        }
    }

    private static Task PumpInput(Stream source, Stream destination)
    {
        return Task.Factory.StartNew(delegate
        {
            byte[] buffer = new byte[8192];
            try
            {
                int count;
                while ((count = source.Read(buffer, 0, buffer.Length)) > 0)
                {
                    destination.Write(buffer, 0, count);
                    destination.Flush();
                }
            }
            catch (IOException) { }
            catch (ObjectDisposedException) { }
            finally
            {
                try { destination.Close(); }
                catch { }
            }
        }, TaskCreationOptions.LongRunning);
    }

    private static Task PumpOutput(Stream source, Stream destination, TaskCompletionSource<bool> firstOutput)
    {
        return Task.Factory.StartNew(delegate
        {
            byte[] buffer = new byte[8192];
            int count;
            try
            {
                while ((count = source.Read(buffer, 0, buffer.Length)) > 0)
                {
                    destination.Write(buffer, 0, count);
                    destination.Flush();
                    firstOutput.TrySetResult(true);
                }
            }
            finally { firstOutput.TrySetResult(false); }
        }, TaskCreationOptions.LongRunning);
    }

    private static Task DrainErrors(StreamReader reader)
    {
        return Task.Factory.StartNew(delegate
        {
            char[] buffer = new char[2048];
            try
            {
                while (reader.Read(buffer, 0, buffer.Length) > 0) { }
            }
            catch (IOException) { }
            catch (ObjectDisposedException) { }
        }, TaskCreationOptions.LongRunning);
    }

    private static string QuoteArgument(string value)
    {
        if (value == null) throw new ArgumentNullException("value");
        StringBuilderBuilder quoted = new StringBuilderBuilder();
        quoted.Append('"');
        int backslashes = 0;
        for (int index = 0; index < value.Length; index++)
        {
            char current = value[index];
            if (current == '\\')
            {
                backslashes++;
                continue;
            }
            if (current == '"')
            {
                quoted.Append('\\', backslashes * 2 + 1);
                quoted.Append('"');
                backslashes = 0;
                continue;
            }
            quoted.Append('\\', backslashes);
            backslashes = 0;
            quoted.Append(current);
        }
        quoted.Append('\\', backslashes * 2);
        quoted.Append('"');
        return quoted.ToString();
    }

    // Keep this launcher compatible with the inbox .NET Framework compiler without
    // adding a dependency on a newer framework assembly.
    private sealed class StringBuilderBuilder
    {
        private readonly System.Text.StringBuilder builder = new System.Text.StringBuilder();
        public void Append(char value) { builder.Append(value); }
        public void Append(char value, int count) { builder.Append(value, count); }
        public override string ToString() { return builder.ToString(); }
    }
}
