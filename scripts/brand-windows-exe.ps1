param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [string]$Target
)

$ErrorActionPreference = 'Stop'
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$targetPath = (Resolve-Path -LiteralPath $Target).Path

if ([System.IO.Path]::GetExtension($sourcePath) -ne '.exe') {
    throw "Zrodlo brandingu musi byc plikiem EXE: $sourcePath"
}
if ([System.IO.Path]::GetExtension($targetPath) -ne '.exe') {
    throw "Brandowany silnik musi byc plikiem EXE: $targetPath"
}
if ([System.IO.Path]::GetFullPath($sourcePath) -eq [System.IO.Path]::GetFullPath($targetPath)) {
    throw 'Zrodlo brandingu i plik docelowy nie moga byc tym samym plikiem.'
}

$nativeSource = @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class NestCafeExeBranding
{
    private const uint LOAD_LIBRARY_AS_DATAFILE = 0x00000002;
    private const uint LOAD_LIBRARY_AS_IMAGE_RESOURCE = 0x00000020;
    private const int ERROR_RESOURCE_TYPE_NOT_FOUND = 1813;

    private delegate bool EnumResNameProc(IntPtr module, IntPtr type, IntPtr name, IntPtr parameter);
    private delegate bool EnumResLangProc(IntPtr module, IntPtr type, IntPtr name, ushort language, IntPtr parameter);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr LoadLibraryExW(string fileName, IntPtr file, uint flags);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool FreeLibrary(IntPtr module);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool EnumResourceNamesW(IntPtr module, IntPtr type, EnumResNameProc callback, IntPtr parameter);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool EnumResourceLanguagesW(IntPtr module, IntPtr type, IntPtr name, EnumResLangProc callback, IntPtr parameter);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindResourceExW(IntPtr module, IntPtr type, IntPtr name, ushort language);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint SizeofResource(IntPtr module, IntPtr resource);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr LoadResource(IntPtr module, IntPtr resource);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr LockResource(IntPtr resourceData);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr BeginUpdateResourceW(string fileName, bool deleteExistingResources);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool UpdateResourceW(IntPtr update, IntPtr type, IntPtr name, ushort language, byte[] data, uint size);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool EndUpdateResourceW(IntPtr update, bool discard);

    public static int Apply(string source, string target)
    {
        IntPtr module = LoadLibraryExW(source, IntPtr.Zero, LOAD_LIBRARY_AS_DATAFILE | LOAD_LIBRARY_AS_IMAGE_RESOURCE);
        if (module == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Nie mozna odczytac zasobow NestCafe.");

        // Start with a clean resource table. Leaving the engine's former icon
        // entries in place lets Explorer pick an orphaned 16px SuperCli icon
        // even when the main icon group was replaced successfully.
        IntPtr update = BeginUpdateResourceW(target, true);
        if (update == IntPtr.Zero)
        {
            FreeLibrary(module);
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Nie mozna otworzyc silnika do brandingu.");
        }

        int copied = 0;
        Exception callbackError = null;
        try
        {
            // RT_ICON, RT_GROUP_ICON and RT_MANIFEST. Other resources, such as
            // version metadata belonging to the engine, remain untouched.
            foreach (int resourceType in new int[] { 3, 14, 24 })
            {
                IntPtr type = new IntPtr(resourceType);
                EnumResNameProc nameCallback = null;
                nameCallback = delegate(IntPtr hModule, IntPtr callbackType, IntPtr name, IntPtr parameter)
                {
                    EnumResLangProc languageCallback = null;
                    languageCallback = delegate(IntPtr languageModule, IntPtr languageType, IntPtr languageName, ushort language, IntPtr languageParameter)
                    {
                        try
                        {
                            IntPtr resource = FindResourceExW(languageModule, languageType, languageName, language);
                            if (resource == IntPtr.Zero)
                                throw new Win32Exception(Marshal.GetLastWin32Error(), "Nie mozna odnalezc zasobu NestCafe.");

                            uint size = SizeofResource(languageModule, resource);
                            IntPtr loaded = LoadResource(languageModule, resource);
                            IntPtr dataPointer = LockResource(loaded);
                            if (loaded == IntPtr.Zero || dataPointer == IntPtr.Zero || size == 0)
                                throw new Win32Exception(Marshal.GetLastWin32Error(), "Nie mozna odczytac zasobu NestCafe.");

                            byte[] data = new byte[size];
                            Marshal.Copy(dataPointer, data, 0, checked((int)size));
                            if (!UpdateResourceW(update, languageType, languageName, language, data, size))
                                throw new Win32Exception(Marshal.GetLastWin32Error(), "Nie mozna zapisac zasobu NestCafe w silniku.");
                            copied++;
                            return true;
                        }
                        catch (Exception error)
                        {
                            callbackError = error;
                            return false;
                        }
                    };

                    bool languagesOk = EnumResourceLanguagesW(hModule, callbackType, name, languageCallback, IntPtr.Zero);
                    GC.KeepAlive(languageCallback);
                    return languagesOk && callbackError == null;
                };

                Marshal.GetLastWin32Error();
                bool namesOk = EnumResourceNamesW(module, type, nameCallback, IntPtr.Zero);
                int errorCode = Marshal.GetLastWin32Error();
                GC.KeepAlive(nameCallback);
                if (callbackError != null)
                    throw callbackError;
                if (!namesOk && errorCode != 0 && errorCode != ERROR_RESOURCE_TYPE_NOT_FOUND)
                    throw new Win32Exception(errorCode, "Nie mozna wyliczyc zasobow NestCafe.");
            }

            if (copied == 0)
                throw new InvalidOperationException("Plik zrodlowy nie zawiera zasobow ikony NestCafe.");
            if (!EndUpdateResourceW(update, false))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Nie mozna zatwierdzic brandingu silnika.");
            update = IntPtr.Zero;
            return copied;
        }
        catch
        {
            if (update != IntPtr.Zero)
                EndUpdateResourceW(update, true);
            throw;
        }
        finally
        {
            FreeLibrary(module);
        }
    }
}
'@

if (-not ('NestCafeExeBranding' -as [type])) {
    Add-Type -TypeDefinition $nativeSource -Language CSharp
}

$copied = [NestCafeExeBranding]::Apply($sourcePath, $targetPath)
Write-Host "Branding NestCafe: zapisano $copied zasobow Windows w $targetPath" -ForegroundColor DarkGreen
